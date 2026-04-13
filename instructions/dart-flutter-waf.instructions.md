---
description: "Dart/Flutter coding standards — effective Dart, widget composition, state management, and null safety."
applyTo: "**/*.dart"
waf:
  - "performance-efficiency"
  - "reliability"
---

# Dart / Flutter — FAI Standards

## Effective Dart Style

- Use `lowerCamelCase` for variables, functions, parameters; `UpperCamelCase` for types, extensions, enums
- Prefer `final` over `var` when a variable is never reassigned
- Use trailing commas on all argument lists, parameter lists, and collection literals for clean diffs
- Prefer single quotes for strings; use interpolation `'Hello $name'` over concatenation
- Never use `new` — Dart 2+ makes it unnecessary
- Annotate return types on public APIs; rely on inference for local variables

## Widget Composition

- Extract widgets into separate classes rather than nesting `build()` deeper than 3 levels
- Prefer `const` constructors on every widget and data class that allows it — reduces rebuilds
- Use `const` keyword at call sites: `const SizedBox(height: 16)` not `SizedBox(height: 16)`

```dart
// preferred — const constructor, extracted widget
class PriceTag extends StatelessWidget {
  const PriceTag({super.key, required this.amount});
  final double amount;

  @override
  Widget build(BuildContext context) {
    return Text('\$${amount.toStringAsFixed(2)}',
        style: Theme.of(context).textTheme.titleMedium);
  }
}
```

## StatelessWidget vs StatefulWidget

- Default to `StatelessWidget`; only use `StatefulWidget` when local mutable state (animations, TextEditingController, focus) is required
- Move business logic into providers/blocs — widgets should only render and dispatch
- Dispose controllers and subscriptions in `dispose()` to prevent memory leaks

## State Management (Riverpod / Bloc)

- Prefer Riverpod `@riverpod` code-generation for type-safe providers with auto-dispose
- Keep state classes immutable — use `freezed` or manual `copyWith` patterns
- Never mutate state directly; always emit a new state object

```dart
// preferred — immutable state with copyWith
@freezed
class CartState with _$CartState {
  const factory CartState({
    @Default([]) List<CartItem> items,
    @Default(false) bool isLoading,
  }) = _CartState;
}

// avoided — mutable state
class CartState {
  List<CartItem> items = []; // WRONG: mutable list
  bool isLoading = false;    // WRONG: direct mutation
}
```

## Null Safety

- Never use `!` (bang operator) unless you can prove non-null with a comment explaining why
- Prefer `?.` and `??` for null-aware access and defaults
- Use `required` on named parameters that must never be null
- Pattern match with `if (value case final v?)` for null checks with binding

## Navigation — go_router

- Define routes declaratively with `GoRouter` configuration; avoid imperative `Navigator.push`
- Use typed route parameters via code-generation (`@TypedGoRoute`)
- Guard authenticated routes with `redirect` callbacks, not manual checks in widgets

```dart
final router = GoRouter(
  redirect: (context, state) {
    final loggedIn = ref.read(authProvider).isAuthenticated;
    if (!loggedIn && state.matchedLocation != '/login') return '/login';
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(path: '/product/:id', builder: (_, state) {
      return ProductScreen(id: state.pathParameters['id']!);
    }),
  ],
);
```

## Theming & Responsive Layout

- Define a single `ThemeData` with `ColorScheme.fromSeed()` — never hardcode colors in widgets
- Use `LayoutBuilder` or `MediaQuery.sizeOf(context)` for responsive breakpoints
- Prefer `Flex`, `Wrap`, and `ConstrainedBox` over fixed pixel widths

## Platform Channels

- Use `MethodChannel` with typed codec; always handle `MissingPluginException`
- Define channel names as constants: `static const _channel = MethodChannel('com.app/feature')`
- Run channel calls inside `try/catch` with `PlatformException` handling

## Testing

- Use `testWidgets` with `WidgetTester` for widget tests; `test` for pure logic
- Pump frames explicitly: `await tester.pumpAndSettle()` after async actions
- Mock dependencies with `ProviderScope.overrides` (Riverpod) or `MockBloc` (Bloc)
- Target 80%+ coverage on business logic; widget tests for critical user flows

```dart
testWidgets('PriceTag renders formatted amount', (tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: PriceTag(amount: 9.99))),
  );
  expect(find.text('\$9.99'), findsOneWidget);
});
```

## Anti-Patterns

| Anti-Pattern | Why It Hurts | Fix |
|---|---|---|
| God widget with 200+ line `build()` | Unreadable, defeats widget caching | Extract child widgets with `const` constructors |
| `setState` for app-wide state | Triggers full subtree rebuilds | Use Riverpod/Bloc with scoped rebuilds |
| `MediaQuery.of(context)` in deep widgets | Rebuilds entire subtree on keyboard open | Use `MediaQuery.sizeOf(context)` (Flutter 3.10+) |
| `FutureBuilder` for network calls | Refires on every rebuild, no caching | Use `AsyncValue` from Riverpod or Bloc events |
| `context.read` inside `build()` | Misses reactive updates | Use `context.watch` or `ref.watch` inside build |
| Skipping `const` on static widgets | Prevents Flutter's const-widget optimization | Add `const` to every eligible constructor call |
| String concatenation for routes | Typo-prone, no compile-time safety | Use `@TypedGoRoute` code-gen or route constants |
| `print()` for logging | No log levels, floods console | Use `package:logging` or `debugPrint` with tags |

## WAF Alignment

| WAF Pillar | Dart/Flutter Practice |
|---|---|
| **Performance Efficiency** | `const` constructors, `RepaintBoundary`, lazy provider initialization, image caching with `cached_network_image` |
| **Reliability** | Null safety, `try/catch` on platform channels, `AsyncValue` error states, `ErrorWidget.builder` for graceful fallback |
| **Security** | Secure storage via `flutter_secure_storage`, certificate pinning with `Dio`, obfuscation with `--obfuscate --split-debug-info` |
| **Cost Optimization** | Tree-shaking unused packages, deferred imports for large features, `compute()` for CPU-bound work off main isolate |
| **Operational Excellence** | `flutter_lints` strict rules, CI with `flutter test --coverage`, Crashlytics integration, `dart fix --apply` in CI |
| **Responsible AI** | Accessibility labels via `Semantics`, sufficient contrast ratios in `ThemeData`, `excludeFromSemantics` only when redundant |

