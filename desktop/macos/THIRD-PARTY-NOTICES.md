# Third-party runtimes

The macOS package includes Electron (MIT/BSD and bundled Chromium/Node notices), MySQL Community Server 8.4.3 (GPLv2 and Oracle's accompanying notices), Playwright Core (Apache-2.0) and the Chromium browser distributed by Playwright. Keep their license/notice files with every redistributed package. npm libraries retain their LICENSE files under app/backend/node_modules.

MySQL runs as an independent subprocess. Its original LICENSE and complete binary distribution remain in vendor/mysql. Upstream corresponding source is available at https://github.com/mysql/mysql-server/tree/mysql-8.4.3 and https://downloads.mysql.com/archives/community/ (Source Code, 8.4.3). The MIT license of this project's source does not replace licenses of bundled runtimes.

Electron upstream: https://github.com/electron/electron/tree/v44.7.0

Playwright upstream: https://github.com/microsoft/playwright/tree/v1.63.0

MySQL archives use HTTPS and pinned SHA-256 checksums in vendor-lock.json. Runtime versions are explicit and should be reviewed when publishing updates. The app is ad-hoc signed for development; it is not signed with an Apple Developer ID or notarized.
