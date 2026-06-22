---
description: "WPF standards — MVVM, data binding, commands, styles, templates."
applyTo: "**/*.xaml, **/*.cs"
waf:
  - "reliability"
---

# WPF — FAI Standards

## MVVM with CommunityToolkit.Mvvm

Use `ObservableObject` as ViewModel base. Source-generated properties via `[ObservableProperty]` eliminate boilerplate. Partial classes required for generators.

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
        try { await _orderService.PlaceAsync(Order, token); }
        catch (HttpRequestException ex) { ErrorMessage = ex.Message; }
    }
}
```

Manual `INotifyPropertyChanged` only when toolkit generators cannot apply (e.g., non-partial classes in legacy assemblies). Never raise `PropertyChanged` for properties that didn't change.

## Data Binding and Converters

Bind in XAML with `Mode`, `UpdateSourceTrigger`, and `FallbackValue`. Never use `ElementName` across `DataTemplate` boundaries — use `RelativeSource` or pass via `DataContext`.

```xml
<TextBox Text="{Binding Email, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged,
         ValidatesOnNotifyDataErrors=True}" />
<TextBlock Text="{Binding Status, Converter={StaticResource StatusToTextConverter},
           FallbackValue='Unknown'}" />
```

`IValueConverter` implementations must be stateless and null-safe. Register as `StaticResource` in merged dictionaries — never instantiate in code-behind.

```csharp
public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type t, object p, CultureInfo c)
        => value is true ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object value, Type t, object p, CultureInfo c)
        => value is Visibility.Visible;
}
```

## Styles, Templates, and Resources

Define `ControlTemplate` for custom chrome, `DataTemplate` for data presentation. Keep `ResourceDictionary` files ≤ 200 lines — split by domain (`Buttons.xaml`, `Colors.xaml`). Merge in `App.xaml`:

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <ResourceDictionary Source="Themes/Colors.xaml" />
            <ResourceDictionary Source="Themes/Buttons.xaml" />
            <ResourceDictionary Source="Themes/DataTemplates.xaml" />
        </ResourceDictionary.MergedDictionaries>
    </ResourceDictionary>
</Application.Resources>
```

Use `BasedOn` for style inheritance. Never duplicate setters across styles — extract a base style.

## UserControls vs Custom Controls

Use `UserControl` for composed UI (multiple controls, fixed layout). Use custom controls (`Control` subclass + `Generic.xaml`) when consumers need to re-template. Always define `DefaultStyleKey` in the custom control constructor. Dependency properties for any value that should be bindable or animatable:

```csharp
public static readonly DependencyProperty HeaderProperty =
    DependencyProperty.Register(nameof(Header), typeof(string), typeof(CardControl),
        new PropertyMetadata(string.Empty, OnHeaderChanged));

private static void OnHeaderChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    => ((CardControl)d).OnHeaderChanged((string)e.OldValue, (string)e.NewValue);
```

## Virtualization

Enable `VirtualizingStackPanel.IsVirtualizing="True"` and `VirtualizationMode="Recycling"` on all `ListBox`/`ListView`/`DataGrid` with >50 items. Set `ScrollViewer.CanContentScroll="True"` (item-based scrolling). For variable-height items use `VirtualizingStackPanel.IsVirtualizingWhenGrouping="True"`. Never wrap virtualized controls in a `StackPanel` — it gives infinite height and defeats virtualization.

## Threading and Async

UI-bound work must run on the dispatcher thread. Use `async/await` — not `Dispatcher.Invoke` — for async-to-UI marshalling. `Task.Run` for CPU-bound work only.

```csharp
[RelayCommand]
private async Task LoadDataAsync()
{
    IsLoading = true;
    var data = await Task.Run(() => _repo.QueryLargeDataset()); // off UI thread
    Items = new ObservableCollection<Item>(data); // auto-marshalled by await
    IsLoading = false;
}
```

Never call `Dispatcher.Invoke` inside a `Task.Run` — use `await` to return to the UI context. Never block the UI thread with `.Result` or `.Wait()`.

## Input Validation (INotifyDataErrorInfo)

Implement `INotifyDataErrorInfo` via `ObservableValidator` from CommunityToolkit. Use `DataAnnotations` for declarative rules:

```csharp
public partial class RegisterViewModel : ObservableValidator
{
    [ObservableProperty]
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress]
    private string _email = string.Empty;

    partial void OnEmailChanged(string value) => ValidateProperty(value, nameof(Email));
}
```

Bind with `ValidatesOnNotifyDataErrors=True`. Show errors via `Validation.ErrorTemplate` or `AdornedElementPlaceholder`.

## Navigation and DI

Use Prism `IRegionManager` for region-based navigation. Register views and ViewModels in `DryIoc` container:

```csharp
protected override void RegisterTypes(IContainerRegistry cr)
{
    cr.RegisterForNavigation<OrdersView, OrdersViewModel>();
    cr.RegisterSingleton<IOrderService, OrderService>();
}
// Navigate with parameters
_regionManager.RequestNavigate("MainRegion", "OrdersView",
    new NavigationParameters { { "customerId", id } });
```

ViewModels implement `INavigationAware` for `OnNavigatedTo`/`OnNavigatedFrom` lifecycle. Dispose subscriptions in `OnNavigatedFrom`. Constructor injection only — no service locator.

## Testing ViewModels

Test ViewModels in isolation with xUnit/NUnit. Mock dependencies with NSubstitute or Moq. No UI thread required — `ObservableObject` works off-dispatcher in tests:

```csharp
[Fact]
public async Task SubmitCommand_ValidOrder_CallsService()
{
    var service = Substitute.For<IOrderService>();
    var vm = new OrderViewModel(service) { IsValid = true };
    await vm.SubmitCommand.ExecuteAsync(null);
    await service.Received(1).PlaceAsync(Arg.Any<Order>(), Arg.Any<CancellationToken>());
}
```

Test `CanExecute` state changes, property change notifications (`vm.PropertyChanged += ...`), and validation errors.

## MSIX Packaging

Package via `.wapproj` or single-project MSIX. Declare capabilities in `Package.appxmanifest` — request only what's needed. Use `Windows.Storage.ApplicationData` for local settings, not raw file paths. Auto-update via `AppInstaller` file with `UpdateFrequency`. Sign with trusted certificate for sideloading or submit to Microsoft Store.

## Anti-Patterns

- ❌ Code-behind with business logic — move to ViewModel
- ❌ `Dispatcher.Invoke` wrapping every async call instead of `await`
- ❌ Wrapping `ListView` in `ScrollViewer` — kills virtualization
- ❌ `ObservableCollection` bulk adds without `CollectionViewSource` — use `AddRange` extensions or replace the collection
- ❌ Service locator (`Container.Resolve<T>()` in ViewModels) — use constructor injection
- ❌ Global `StaticResource` keys without namespacing — causes merge collisions
- ❌ Storing secrets in `app.config` or embedded resources — use DPAPI or Azure Key Vault
- ❌ `Thread.Sleep` or `.Result` on the UI thread — freezes the application
- ❌ Raising `PropertyChanged` with magic strings — use `nameof()` or source generators

## WAF Alignment

| Pillar | WPF Practice |
|--------|-------------|
| **Reliability** | Async commands with cancellation, global `DispatcherUnhandledException` handler, input validation before submit, graceful offline fallback with cached data |
| **Security** | DPAPI/Key Vault for secrets, input sanitization in converters, MSIX signing, no secrets in XAML resources, least-privilege package capabilities |
| **Cost Optimization** | Virtualized lists reduce memory, lazy-load heavy views via region navigation, reuse `DataTemplate` and styles, `Freezable.Freeze()` on shared brushes/geometries |
| **Operational Excellence** | Serilog/AppInsights structured logging, MSIX auto-update, CI build with `dotnet publish`, ViewModel unit tests in pipeline |
| **Performance** | UI virtualization, `Binding.IsAsync` for slow properties, `CollectionView` filtering over LINQ re-query, `Freeze()` on immutable resources, compiled bindings via `x:Bind` (WinUI migration path) |
| **Responsible AI** | Content safety filtering before displaying AI-generated text, user consent for telemetry collection, accessible UI (AutomationProperties, high-contrast themes) |
