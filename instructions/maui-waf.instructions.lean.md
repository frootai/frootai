---
description: "MAUI standards — cross-platform, MVVM, dependency injection, platform-specific."
applyTo: "**/*.xaml, **/*.cs"
waf:
  - "reliability"
  - "performance-efficiency"
---

# .NET MAUI — FAI Standards

## MVVM with CommunityToolkit.Mvvm

Use source generators — never implement `INotifyPropertyChanged` manually:

```csharp
public partial class OrderViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(TotalDisplay))]
    private decimal _total;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(SubmitCommand))]
    private bool _isValid;

    public string TotalDisplay => Total.ToString("C");

    [RelayCommand(CanExecute = nameof(IsValid))]
    private async Task SubmitAsync(CancellationToken token)
    {
        IsBusy = true;
        await _orderService.PlaceAsync(Order, token);
        await Shell.Current.GoToAsync("..");
    }
}
```

- Prefix backing fields with `_` — generator creates PascalCase property
- Use `[NotifyCanExecuteChangedFor]` to re-evaluate command availability
- Pass `CancellationToken` to all async relay commands

## Shell Navigation

Register routes in `AppShell.xaml.cs`, use typed query parameters:

```csharp
// Registration
Routing.RegisterRoute(nameof(OrderDetailPage), typeof(OrderDetailPage));

// Navigate with parameters
await Shell.Current.GoToAsync($"{nameof(OrderDetailPage)}?id={order.Id}");

// Receive parameters
[QueryProperty(nameof(OrderId), "id")]
public partial class OrderDetailViewModel : ObservableObject
{
    [ObservableProperty] private string _orderId;

    partial void OnOrderIdChanged(string value) => LoadOrder(value);
}
```

- Never navigate from Views — always from ViewModels via `Shell.Current`
- Use `".."` for back navigation, `"//route"` for absolute routes
- Complex objects: pass via `IDictionary<string, object>` or a shared service

## Dependency Injection — MauiProgram.cs

```csharp
public static MauiApp CreateMauiApp()
{
    var builder = MauiApp.CreateBuilder();
    builder.UseMauiApp<App>()
           .ConfigureFonts(fonts => fonts.AddFont("Inter-Regular.ttf", "Inter"));

    // Services
    builder.Services.AddSingleton<IConnectivity>(Connectivity.Current);
    builder.Services.AddSingleton<ISecureStorage>(SecureStorage.Default);
    builder.Services.AddSingleton<IOrderService, OrderService>();

    // HttpClient with resilience
    builder.Services.AddHttpClient<IApiClient, ApiClient>(c =>
        c.BaseAddress = new Uri(Config.ApiBaseUrl))
        .AddStandardResilienceHandler();

    // ViewModels & Pages (transient)
    builder.Services.AddTransient<OrderViewModel>();
    builder.Services.AddTransient<OrderPage>();

    return builder.Build();
}
```

- Register platform abstractions as singletons (`Connectivity.Current`, `SecureStorage.Default`)
- Pages and ViewModels as transient — avoids stale state after navigation
- Use `AddHttpClient` + `AddStandardResilienceHandler()` from `Microsoft.Extensions.Http.Resilience`

## Platform-Specific Code

```csharp
// Conditional compilation
#if ANDROID
    var activity = Platform.CurrentActivity;
    Window.SetStatusBarColor(Android.Graphics.Color.ParseColor("#1a1a2e"));
#elif IOS
    UIApplication.SharedApplication.StatusBarStyle = UIStatusBarStyle.LightContent;
#endif

// Partial classes (preferred for larger blocks)
// Platforms/Android/Services/BiometricService.cs
public partial class BiometricService
{
    public partial Task<bool> AuthenticateAsync()
    {
        var executor = ContextCompat.GetMainExecutor(Platform.AppContext);
        // Android BiometricPrompt implementation
    }
}
```

- Prefer partial classes in `Platforms/{OS}/` over `#if` for anything >5 lines
- Use `DeviceInfo.Platform` for runtime checks, `#if` for compile-time

## Handlers vs Renderers

Always use Handlers (not legacy Renderers). Customize via mapper:

```csharp
Microsoft.Maui.Handlers.EntryHandler.Mapper.AppendToMapping("BorderlessEntry", (handler, view) =>
{
#if ANDROID
    handler.PlatformView.SetBackgroundColor(Android.Graphics.Color.Transparent);
#elif IOS
    handler.PlatformView.BorderStyle = UIKit.UITextBorderStyle.None;
#endif
});
```

## CollectionView Performance

```xml
<CollectionView ItemsSource="{Binding Orders}"
                ItemSizingStrategy="MeasureFirstItem"
                SelectionMode="Single"
                SelectionChangedCommand="{Binding SelectOrderCommand}">
    <CollectionView.ItemTemplate>
        <DataTemplate x:DataType="models:Order">
            <Grid Padding="12" ColumnDefinitions="*,Auto">
                <Label Text="{Binding Name}" FontSize="16" />
                <Label Grid.Column="1" Text="{Binding Total, StringFormat='{0:C}'}" />
            </Grid>
        </DataTemplate>
    </CollectionView.ItemTemplate>
</CollectionView>
```

- Set `ItemSizingStrategy="MeasureFirstItem"` for uniform rows — avoids per-item measure pass
- Always set `x:DataType` on `DataTemplate` for compiled bindings
- Use `DataTemplateSelector` when mixing row layouts — never `IsVisible` toggle inside a single template
- For 1000+ items: use `RemainingItemsThreshold` + `RemainingItemsThresholdReachedCommand` for incremental loading
- Avoid nested `CollectionView` — flatten data or use grouped `CollectionView` with `IsGrouped="True"`

## Resource Dictionaries & Styles

```xml
<!-- App.xaml — global styles -->
<Style TargetType="Label" x:Key="Heading1">
    <Setter Property="FontSize" Value="24" />
    <Setter Property="FontAttributes" Value="Bold" />
    <Setter Property="TextColor" Value="{AppThemeBinding Light={StaticResource Gray900}, Dark={StaticResource White}}" />
</Style>

<!-- Implicit style (no x:Key) applies to ALL Labels -->
<Style TargetType="Entry">
    <Setter Property="BackgroundColor" Value="Transparent" />
</Style>
```

- Use `AppThemeBinding` for Light/Dark mode — never hardcode colors
- Keep `Colors.xaml` and `Styles.xaml` separate in `Resources/Styles/`
- Use `StaticResource` for values that never change, `DynamicResource` for theme-switched values

## Lifecycle Events

```csharp
protected override void OnAppearing()
{
    base.OnAppearing();
    _viewModel.LoadDataCommand.Execute(null);
    Connectivity.ConnectivityChanged += OnConnectivityChanged;
}

protected override void OnDisappearing()
{
    base.OnDisappearing();
    Connectivity.ConnectivityChanged -= OnConnectivityChanged;
    _cts?.Cancel(); // Cancel in-flight operations
}
```

- Always unsubscribe events in `OnDisappearing` — prevents memory leaks
- Cancel `CancellationTokenSource` on disappearing for pending HTTP calls
- Use `OnNavigatedTo` (Shell) for data that should reload on every visit

## Secure Storage & Connectivity

```csharp
// Store tokens securely (encrypted per-platform)
await SecureStorage.Default.SetAsync("auth_token", token);
var saved = await SecureStorage.Default.GetAsync("auth_token");

// Check connectivity before network calls
if (Connectivity.Current.NetworkAccess != NetworkAccess.Internet)
{
    await Shell.Current.DisplayAlert("Offline", "No internet connection.", "OK");
    return;
}
```

- Never store secrets in `Preferences` — use `SecureStorage` (Keychain on iOS, EncryptedSharedPreferences on Android)
- Inject `IConnectivity` in ViewModels — testable and mockable

## Responsive Layouts

```xml
<Grid RowDefinitions="Auto,*" ColumnDefinitions="*,*"
      Padding="{OnIdiom Phone='16', Tablet='32'}">
    <Label Text="{Binding Title}"
           FontSize="{OnIdiom Phone=20, Tablet=28}"
           Grid.ColumnSpan="{OnIdiom Phone=2, Tablet=1}" />

    <FlexLayout Direction="Row" Wrap="Wrap" JustifyContent="SpaceEvenly"
                Grid.Row="1" Grid.ColumnSpan="2">
        <Frame FlexLayout.Basis="{OnIdiom Phone='100%', Tablet='48%'}" />
    </FlexLayout>
</Grid>

<!-- Platform-specific -->
<Label Margin="{OnPlatform iOS='0,20,0,0', Android='0,0,0,0'}" />
```

- Use `OnIdiom` for Phone/Tablet/Desktop breakpoints
- Use `OnPlatform` for OS-specific padding (iOS safe area)
- `FlexLayout` with `Wrap="Wrap"` for adaptive card grids

## Testing

### Unit Testing ViewModels
```csharp
[Fact]
public async Task SubmitCommand_InvalidOrder_DoesNotCallService()
{
    var mockService = Substitute.For<IOrderService>();
    var vm = new OrderViewModel(mockService) { IsValid = false };

    Assert.False(vm.SubmitCommand.CanExecute(null));
    await Assert.ThrowsAsync<InvalidOperationException>(
        () => vm.SubmitCommand.ExecuteAsync(null));
    await mockService.DidNotReceive().PlaceAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>());
}
```

### UI Testing with Appium
```csharp
[Fact]
public void OrderPage_TapSubmit_NavigatesToConfirmation()
{
    var submitBtn = _driver.FindElement(MobileBy.AccessibilityId("SubmitButton"));
    submitBtn.Click();
    Assert.NotNull(_driver.FindElement(MobileBy.AccessibilityId("ConfirmationLabel")));
}
```

- Set `AutomationId` on every interactive element for Appium/accessibility
- Use NSubstitute or Moq — mock `IConnectivity`, `ISecureStorage`, services
- Test command `CanExecute` logic, property change notifications, navigation calls

## Anti-Patterns

- ❌ Code-behind with business logic — keep pages thin, use ViewModels
- ❌ `async void` anywhere except event handlers — causes unobserved exceptions
- ❌ Manual `PropertyChanged` instead of `[ObservableProperty]` source generator
- ❌ Legacy custom Renderers — migrate to Handlers
- ❌ `Device.BeginInvokeOnMainThread` — use `MainThread.InvokeOnMainThreadAsync`
- ❌ Hardcoded colors/sizes — use resource dictionaries + `AppThemeBinding`
- ❌ Storing tokens in `Preferences` — use `SecureStorage`
- ❌ Nested `ScrollView` inside `CollectionView` — causes layout chaos
- ❌ Not setting `x:DataType` on DataTemplates — loses compiled binding perf
- ❌ Subscribing to events in `OnAppearing` without unsubscribing in `OnDisappearing`

## WAF Alignment

| Pillar | MAUI Application |
|---|---|
| **Reliability** | HttpClient resilience handler, `CancellationToken` propagation, connectivity checks before network calls, graceful offline fallback |
| **Security** | `SecureStorage` for tokens, HTTPS certificate pinning, `OnPlatform` biometric auth, obfuscated release builds, no secrets in XAML |
| **Performance** | Compiled bindings (`x:DataType`), `MeasureFirstItem` sizing, image caching, lazy-loaded tabs, `DataTemplateSelector` over visibility toggles |
| **Cost Optimization** | Share 95%+ code cross-platform, single codebase CI/CD, conditional `#if` only for true platform gaps |
| **Operational Excellence** | Centralized DI in `MauiProgram.cs`, structured logging via `ILogger`, crash reporting (App Center / Sentry), automated UI tests in CI |
| **Responsible AI** | Accessible labels on all controls (`SemanticProperties`), `AutomationId` for screen readers, RTL layout support, high-contrast theme compliance |
