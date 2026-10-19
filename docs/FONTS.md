# Typography

Finish Line uses the platform system font stack:

```
-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui,
"Helvetica Neue", Helvetica, Arial, sans-serif
```

On Apple devices this renders San Francisco with its built-in optical sizing and tracking tables; other platforms fall back to their own UI face (Segoe UI, Roboto). No web fonts are downloaded, so there is no render-blocking font request and no third-party font licence to ship.

The earlier Barlow / Barlow Condensed WOFF2 files (SIL Open Font License) were removed in the Apple-style redesign. They remain in git history.
