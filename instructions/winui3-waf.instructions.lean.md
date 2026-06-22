---
description: "WinUI 3 standards — XAML, MVVM, Windows App SDK patterns."
applyTo: "**/*.xaml, **/*.cs"
waf:
  - "reliability"
  - "performance-efficiency"
---

# WinUI 3 — FAI Standards

## MVVM with CommunityToolkit.Mvvm

- All ViewModels inherit `ObservableObject`; use `[ObservableProperty]` and `[RelayCommand]` source generators
- Never put business logic in code-behind — code-behind only for view-specific concerns (focus, animations)
- Use `ObservableValidator` for form ViewModels with `DataAnnotations` validation

```csharp
public partial class CustomerViewModel : ObservableValidator
{
    [ObservableProperty]
    [NotifyDataErrorInfo]
    [Required, MinLength(2)]
    private string _name = string.Empty;

    [RelayCommand]
    private async Task SaveAsync()
    {
        ValidateAllProperties();
        if (HasErrors) return;
        await _repository.SaveAsync(new Customer(Name));
    }
}
```

## WinUI 3 Controls

- `NavigationView` with `PaneDisplayMode="Left"` for primary navigation; bind `SelectedItem` to ViewModel
- `TabView` for document-style UX; handle `TabCloseRequested` to confirm unsaved changes
- `InfoBar` for non-blocking status messages — never use `ContentDialog` for transient notifications
- `TeachingTip` for contextual onboarding; set `IsLightDismissEnabled="True"`

## Windowing & Title Bar

- Use `AppWindow` API (not legacy `ApplicationView`) for multi-window and custom title bars
- Set `ExtendsContentIntoTitleBar = true` on Window, define `SetTitleBar()` with a XAML element
- Handle `AppWindow.Changed` for position/size persistence across sessions

```csharp
// App startup — custom title bar
var appWindow = this.AppWindow;
appWindow.TitleBar.ExtendsContentIntoTitleBar = true;
appWindow.TitleBar.ButtonBackgroundColor = Colors.Transparent;
SetTitleBar(AppTitleBar); // XAML Grid element
```

## Resource Dictionaries & Theming

- Define app-wide styles in `Themes/Generic.xaml`; merge into `App.xaml` `<Application.Resources>`
- Use `ThemeResource` (not `StaticResource`) for colors that respond to Light/Dark switching
- Override system brushes via `ResourceDictionary.ThemeDictionaries` keyed `"Light"` / `"Dark"` / `"HighContrast"`
- Expose `ActualTheme` from root `FrameworkElement` — never cache theme at startup

## ContentDialog Patterns

- Always set `XamlRoot = Content.XamlRoot` before calling `ShowAsync()` — crashes without it
- Only one `ContentDialog` can be open at a time; queue or cancel the previous one
- Use `ContentDialog` for destructive confirmations, not routine feedback

## Data Binding

- Prefer `x:Bind` (compiled, type-safe) over `{Binding}` for performance and compile-time errors
- Always set `x:DataType` on the page/template to enable compiled bindings
- Use `x:Bind Mode=OneWay` explicitly — `x:Bind` defaults to `OneTime`, unlike `{Binding}`

```xml
<Page x:DataType="viewmodels:CustomerViewModel">
    <TextBox Text="{x:Bind Name, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}" />
    <Button Command="{x:Bind SaveCommand}" Content="Save" />
    <ListView ItemsSource="{x:Bind Items, Mode=OneWay}"
              x:DefaultBindMode="OneWay">
        <ListView.ItemTemplate>
            <DataTemplate x:DataType="models:Item">
                <TextBlock Text="{x:Bind Title}" />
            </DataTemplate>
        </ListView.ItemTemplate>
    </ListView>
</Page>
```

## Dependency Injection

- Register services in `App.xaml.cs` using `Microsoft.Extensions.DependencyInjection`
- Expose `IServiceProvider` as a static property on `App` for resolution in views
- ViewModels receive dependencies via constructor injection — never use service locator in VMs

```csharp
// App.xaml.cs
public partial class App : Application
{
    public static IServiceProvider Services { get; private set; } = null!;

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        var services = new ServiceCollection();
        services.AddSingleton<ICustomerRepository, SqlCustomerRepository>();
        services.AddTransient<CustomerViewModel>();
        Services = services.BuildServiceProvider();
        m_window = new MainWindow();
        m_window.Activate();
    }
}
```

## Navigation

- Use frame-based navigation; `NavigationView.SelectionChanged` triggers `Frame.Navigate(typeof(Page))`
- Pass parameters via `Navigate(typeof(DetailPage), itemId)` — retrieve in `OnNavigatedTo`
- Implement `INavigationService` abstraction so ViewModels navigate without referencing `Frame`

## File & Folder Pickers

- Use `StorageFile` / `StoragePicker` APIs with `WinRT.Interop` to set owner HWND
- Always call `InitializeWithWindow` — pickers crash without an owner window handle
- Request `FileTypeFilter` explicitly; empty filter throws `COMException`

```csharp
var picker = new FileOpenPicker();
WinRT.Interop.InitializeWithWindow.Initialize(picker,
    WinRT.Interop.WindowNative.GetWindowHandle(App.MainWindow));
picker.FileTypeFilter.Add(".json");
var file = await picker.PickSingleFileAsync();
```

## App Lifecycle

- Handle `Activated` event on `AppInstance` for protocol/file activation and single-instancing
- Save state in `Window.Closed` or `EnteredBackground` — no guaranteed `OnSuspending` for unpackaged
- Use `AppInstance.GetCurrent().GetActivatedEventArgs()` for activation kind detection

## Packaging

- **MSIX**: full Store/sideload support, auto-update, clean install/uninstall, identity for push notifications
- **Unpackaged**: set `<WindowsPackageType>None</WindowsPackageType>` in `.csproj`; no identity features
- Use `PublishSingleFile` + `SelfContained` for unpackaged distribution without .NET prerequisite

## Testing

- Unit test ViewModels with xUnit/NUnit — no UI thread needed since `ObservableObject` is POCO
- Use WinAppDriver or Appium for UI automation tests on real controls
- Mock `IServiceProvider` dependencies; never instantiate real DB/HTTP in VM unit tests
- Test `[RelayCommand] CanExecute` logic separately — verify button enable/disable states

## Performance

- `x:Load="False"` on panels/sections not immediately visible — defer creation until needed
- `ItemsRepeater` with `VirtualizingLayout` for large lists instead of `ListView` for custom layouts
- Avoid `x:Bind` with `FallbackValue` in hot paths — fallback evaluation adds overhead
- Set `CacheSize` on `Frame` to keep recently visited pages alive (default 10)
- Profile with `VisualDiagnostics` and Windows Performance Analyzer for XAML thread stalls

## Anti-Patterns

- ❌ Putting async logic in constructors — use `[RelayCommand]` or factory methods with `async Task`
- ❌ Using `{Binding}` without `x:DataType` — loses compile-time safety and is 5-10x slower
- ❌ Showing `ContentDialog` without setting `XamlRoot` — runtime crash on WinUI 3
- ❌ Calling pickers without `InitializeWithWindow` — COM exception, no dialog appears
- ❌ Storing window state in static fields — breaks multi-window; use per-`AppWindow` state
- ❌ Using `DispatcherTimer` for background work — use `Task.Run` + `DispatcherQueue.TryEnqueue`
- ❌ Direct `Frame.Navigate` from ViewModel — breaks testability; use `INavigationService`
- ❌ Ignoring `HighContrast` theme dictionary — accessibility compliance failure

## WAF Alignment

| Pillar | WinUI 3 Practice |
|--------|-----------------|
| **Reliability** | Persist state in `Window.Closed`; handle `AppInstance` restart; validate all picker results for `null` |
| **Security** | Use MSIX identity for Windows Hello / push notifications; never store tokens in `ApplicationData` unencrypted; validate file picker MIME types |
| **Performance** | `x:Bind` compiled bindings; `x:Load` deferred loading; `ItemsRepeater` virtualization; `CacheSize` on Frame; background threads via `Task.Run` |
| **Cost Optimization** | `PublishTrimmed` + `PublishSingleFile` to reduce distributable size; lazy-load heavy controls; share `HttpClient` instances |
| **Operational Excellence** | Structured logging via `ILogger` + Serilog sink; crash telemetry with `UnhandledException`; CI build with `dotnet publish` + MSIX signing |
| **Responsible AI** | Accessible contrast ratios via `HighContrast` theme; screen reader support with `AutomationProperties`; localized strings via `.resw` resource files |
