---
description: "WordPress development standards — hooks/filters, custom post types, security, and performance."
applyTo: "**/*.php"
waf:
  - "security"
  - "performance-efficiency"
---

# WordPress — FAI Standards

## Theme Development

- Use child themes — never modify parent theme files directly
- `functions.php` is the theme's plugin: hooks only, no HTML output
- Follow template hierarchy: `single-{post_type}.php` > `single.php` > `singular.php` > `index.php`
- Prefix all functions, constants, and globals with theme slug to avoid collisions

```php
// functions.php — child theme setup
add_action( 'wp_enqueue_scripts', 'mytheme_enqueue_assets' );
function mytheme_enqueue_assets(): void {
    wp_enqueue_style( 'mytheme-parent', get_template_directory_uri() . '/style.css' );
    wp_enqueue_style( 'mytheme-child', get_stylesheet_uri(), array( 'mytheme-parent' ), wp_get_theme()->get( 'Version' ) );
    wp_enqueue_script( 'mytheme-main', get_stylesheet_directory_uri() . '/js/main.js', array( 'jquery' ), '1.0.0', true );
    wp_localize_script( 'mytheme-main', 'mythemeData', array(
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
        'nonce'   => wp_create_nonce( 'mytheme_action' ),
    ) );
}
```

## Block Editor (Gutenberg)

- Register blocks via `block.json` — never inline `registerBlockType` metadata
- Use `@wordpress/scripts` for build tooling (`wp-scripts build`)
- Server-side rendering with `render_callback` for dynamic blocks

```php
add_action( 'init', 'mytheme_register_blocks' );
function mytheme_register_blocks(): void {
    register_block_type( __DIR__ . '/blocks/hero', array(
        'render_callback' => 'mytheme_render_hero_block',
    ) );
}
function mytheme_render_hero_block( array $attributes, string $content ): string {
    $title = esc_html( $attributes['title'] ?? '' );
    return sprintf( '<section class="hero"><h2>%s</h2>%s</section>', $title, $content );
}
```

## Custom Post Types & Taxonomies

```php
add_action( 'init', 'mytheme_register_cpts' );
function mytheme_register_cpts(): void {
    register_post_type( 'portfolio', array(
        'labels'       => array( 'name' => __( 'Portfolio', 'mytheme' ), 'singular_name' => __( 'Project', 'mytheme' ) ),
        'public'       => true,
        'has_archive'  => true,
        'show_in_rest' => true, // Required for block editor support
        'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
        'menu_icon'    => 'dashicons-portfolio',
        'rewrite'      => array( 'slug' => 'portfolio' ),
    ) );
    register_taxonomy( 'project_type', 'portfolio', array(
        'hierarchical' => true,
        'show_in_rest' => true,
        'rewrite'      => array( 'slug' => 'project-type' ),
    ) );
}
```

## WP REST API

- Always define `permission_callback` — omitting it triggers a `_doing_it_wrong` notice
- Use `sanitize_callback` on every `register_rest_route` argument
- Return `WP_Error` with proper HTTP status codes for failures

```php
add_action( 'rest_api_init', 'mytheme_register_routes' );
function mytheme_register_routes(): void {
    register_rest_route( 'mytheme/v1', '/projects', array(
        'methods'             => 'GET',
        'callback'            => 'mytheme_get_projects',
        'permission_callback' => '__return_true', // Public endpoint
        'args'                => array(
            'per_page' => array( 'default' => 10, 'sanitize_callback' => 'absint' ),
        ),
    ) );
}
function mytheme_get_projects( WP_REST_Request $request ): WP_REST_Response {
    $query = new WP_Query( array(
        'post_type'      => 'portfolio',
        'posts_per_page' => min( $request->get_param( 'per_page' ), 100 ),
    ) );
    return new WP_REST_Response( array_map( 'mytheme_format_project', $query->posts ), 200 );
}
```

## Hooks System

- `add_action` for side effects, `add_filter` for data transformation — never mix
- Use priority (default 10) to control execution order; lower = earlier
- Remove hooks with exact same callback, priority: `remove_action( 'hook', 'callback', 10 )`
- Late priorities (999) for overrides; early (1) for validation/sanitization

## Security

- **Nonces**: verify on every form submission and AJAX request
- **Output escaping**: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()` — escape late, at render
- **Input sanitization**: `sanitize_text_field()`, `sanitize_email()`, `absint()` — sanitize early, at input
- **Database queries**: always use `$wpdb->prepare()` — never concatenate user input into SQL
- **Capability checks**: `current_user_can( 'edit_posts' )` before any privileged operation

```php
// Secure form processing pattern
add_action( 'admin_post_mytheme_save', 'mytheme_handle_form' );
function mytheme_handle_form(): void {
    if ( ! wp_verify_nonce( $_POST['_wpnonce'] ?? '', 'mytheme_save' ) ) {
        wp_die( 'Security check failed', 403 );
    }
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( 'Unauthorized', 403 );
    }
    $title = sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) );
    global $wpdb;
    $wpdb->update(
        $wpdb->prefix . 'mytheme_items',
        array( 'title' => $title ),
        array( 'id' => absint( $_POST['item_id'] ?? 0 ) ),
        array( '%s' ),
        array( '%d' )
    );
    wp_safe_redirect( wp_get_referer() );
    exit;
}
```

## WP-CLI Automation

- Use WP-CLI for migrations, imports, cron: `wp mytheme import --file=data.csv`
- Register commands via `WP_CLI::add_command( 'mytheme', 'MyTheme_CLI' )`
- Never run `wp` commands as root — use `--allow-root` only in containers

## Caching & Performance

- **Transients**: cache expensive queries — `set_transient( 'key', $data, HOUR_IN_SECONDS )`
- **Object cache**: persistent backend (Redis/Memcached) for production — `wp_cache_get/set`
- **Query optimization**: avoid `'posts_per_page' => -1` — always paginate or set explicit limits
- Lazy-load images: WordPress adds `loading="lazy"` by default since 5.5 — don't duplicate
- Minimize `get_option()` calls in loops — batch via `wp_load_alloptions()` for autoloaded options

## Custom Fields

- Use `register_meta()` for REST API exposure; ACF for admin UI
- Store structured data as serialized arrays only when you never query by subfield
- Use postmeta for per-post data, options API for site-wide settings

## Internationalization

- Wrap all user-facing strings: `__( 'Text', 'mytheme' )` for return, `_e( 'Text', 'mytheme' )` for echo
- Generate `.pot` files: `wp i18n make-pot . languages/mytheme.pot`
- Use placeholders with `sprintf`: `sprintf( __( 'Found %d items', 'mytheme' ), $count )`
- Never concatenate translatable strings — translators need full phrases for context

## Coding Standards

- Enforce `WordPress-Core` ruleset via PHPCS: `phpcs --standard=WordPress-Core`
- Yoda conditions: `if ( true === $value )` — prevents accidental assignment
- Tabs for indentation, spaces for mid-line alignment
- Opening braces on same line, `elseif` (not `else if`), strict comparisons (`===`)

## Anti-Patterns

- ❌ Direct `$_GET/$_POST` access without `sanitize_*` and nonce verification
- ❌ Raw SQL via `$wpdb->query()` without `$wpdb->prepare()` — SQL injection vector
- ❌ Modifying parent theme files — updates will overwrite all changes
- ❌ Enqueueing scripts with hardcoded `<script>` tags instead of `wp_enqueue_script`
- ❌ Using `query_posts()` — corrupts the main query; use `WP_Query` or `pre_get_posts`
- ❌ `posts_per_page => -1` on large datasets — memory exhaustion on tables with 100k+ rows
- ❌ Storing plugin/theme options as individual rows — use a single serialized option array
- ❌ `extract()` on untrusted data — creates arbitrary variables, code injection risk
- ❌ Missing text domains in `__()` / `_e()` — breaks translations entirely
- ❌ Registering REST routes without `permission_callback` — exposes data publicly by default

## WAF Alignment

| Pillar | WordPress Practice |
|---|---|
| **Security** | Nonce verification on all forms/AJAX, `$wpdb->prepare()` for all queries, `esc_*()` on all output, capability checks before privileged ops, `wp_unslash()` before sanitization |
| **Performance** | Transient API + object cache (Redis), paginated `WP_Query` with indexed meta, `wp_enqueue_script` with `in_footer: true`, lazy loading, `update_post_meta_cache: false` when unneeded |
| **Reliability** | Child themes survive parent updates, `is_wp_error()` checks on all WP API calls, `wp_safe_redirect()` over `wp_redirect()`, graceful fallbacks when plugins are deactivated |
| **Cost Optimization** | Autoloaded options kept under 1MB total, `fields => 'ids'` for count-only queries, CDN for static assets via `WP_CONTENT_URL`, avoid loading admin scripts on frontend |
| **Operational Excellence** | WP-CLI for deployments and cron, PHPCS in CI pipeline, `WP_DEBUG_LOG` to file (never to screen in prod), `wp-config.php` environment-based constants |
