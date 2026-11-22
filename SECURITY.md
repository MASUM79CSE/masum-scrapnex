# Security policy

## Supported versions

| Version             | Status                                       |
| ------------------- | -------------------------------------------- |
| 0.1.x (development) | Security fixes only; not a published release |

## Reporting a vulnerability

Please report privately through GitHub's
[security advisories](https://github.com/MASUM79CSE/masum-scrapnex/security/advisories/new)
rather than a public issue. Include reproduction steps and the version shown in the workspace
footer. There is no bug bounty. Expect an acknowledgement within seven days.

## Threat model

The extension runs against untrusted web pages and must never let page content escalate into
extension privileges.

| Threat                                     | Control                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Malicious page reading extension state     | Agents run in the isolated world, receive no secrets, and return bounded plain data that is schema-validated in the shell             |
| Hostile markup executing in the UI         | Page text is rendered as React text nodes; no `innerHTML` with page-derived strings; exports escape formula prefixes                  |
| Excess permission                          | No host permissions and no static content scripts; access is granted per tab by invoking the extension (`activeTab`)                  |
| Data exfiltration                          | No telemetry, no analytics, no remote code and no `fetch`/`XHR`/`sendBeacon` path for collected data; download is a local file action |
| Path traversal or unsafe links             | Extracted URLs must be `http(s)` without credentials; values are length-bounded                                                       |
| Storage exhaustion                         | Bounded snapshots (20), payload budget (24 MiB), explicit quota errors and age-based cleanup                                          |
| Imported configuration as an attack vector | Strict format/version/field allowlist, 24 KiB cap, origin and schema validation, explicit review before saving                        |

## Permissions and why

| Permission  | Reason                                                        |
| ----------- | ------------------------------------------------------------- |
| `activeTab` | Temporary access to the tab the user invokes the extension on |
| `scripting` | Inject the packaged agent into that tab after invocation      |
| `storage`   | Local settings and preferences only                           |
| `sidePanel` | Host the workspace in Chrome's side panel                     |

CI fails the build if `host_permissions` or static `content_scripts` ever appear in the
production manifest.

## Data handling

All processing is local. Saved snapshots and configurations live in extension-local IndexedDB
and `storage.local`, never synced to a server. Removing the extension removes that data.
