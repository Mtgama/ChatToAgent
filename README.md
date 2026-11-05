# ChatToAgent · Mehrdad MCP

**Turn supported AI chat websites into a workspace connected to local MCP tools.**

Persian-first Chrome extension and local control panel by **mehrdad hasanzade**, based on [MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant), licensed under MIT.

**Version:** 0.7.1 · **Interface:** Persian / RTL · **Documentation:** English & فارسی

[English](#english) · [راهنمای فارسی](#فارسی) · [نسخهٔ مستقل فارسی](README.fa.md)

## English

### What it does

ChatToAgent connects a browser chat to local tools through the Model Context Protocol (MCP). The extension gives the model tool instructions, recognizes structured calls in its response, displays a **Run** button, and returns tool results to the conversation. The local companion installs and manages the tool server, chooses the allowed project directory, and displays logs.

Your chat website supplies the AI model. This repository supplies the extension and local tool infrastructure; it does not include a model, a chat subscription, or an API provider for coding agents. No model API key is required for the local MCP setup. Website account requirements still apply.

```text
Chat website → Chrome extension → local MCP endpoint → filesystem / memory / thinking
                                      ↑
                                   OpenCode

Chrome toolbar popup → authenticated local manager → workspace, tools, start/stop, logs
```

### Features

- Persian RTL sidebar, toolbar popup, and local management interface, credited to mehrdad hasanzade.
- White light theme and a near-black dark theme with neon green accents.
- In-page MCP menu with default instructions, copy/insert actions, tool selection, and automation controls.
- ChatGPT and GapGPT response detection and tool-card compatibility fixes.
- Workspace selection from the extension and companion, applied to the filesystem server.
- Local tool installation/repair, start/stop/restart, live log filtering and download.
- Shared MCP endpoint for the browser and OpenCode, including simultaneous client sessions.
- Linux user-service installer, desktop shortcut, and command-line launcher.

### Requirements and compatibility

| Component               | Requirement / status                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Node.js                 | 22.12 or newer; Node 24 is used for release verification                                                     |
| Extension build         | pnpm 9.15.1, Git, Bash, internet access for dependencies                                                     |
| Browser                 | Chrome / Chromium with unpacked-extension support                                                            |
| Linux installation      | Desktop session with `systemctl --user`; folder picker depends on available desktop utilities                |
| Other operating systems | Manual companion startup is available; macOS/Windows installation and Firefox are not certified by this fork |

ChatGPT and `gapgpt.app` have dedicated compatibility regressions. DeepSeek, Gemini, and Perplexity have been reported working by the user. Other adapters inherited from upstream are present, but their current website versions are not all verified. Website DOM changes can require adapter updates. GapGPT currently supports direct prompt insertion, not the file-attachment shortcut.

### Install from source

Run the following in Bash on Linux. Install a supported Node.js first (`node --version`), then install the pinned pnpm version if necessary:

```sh
npm install --global pnpm@9.15.1
git clone https://github.com/Mtgama/ChatToAgent.git
cd ChatToAgent
pnpm install --frozen-lockfile
pnpm build
npm ci --prefix companion
bash companion/install.sh --enable
```

`pnpm build` creates **`dist/`**. `npm ci --prefix companion` installs the pinned tool packages and applies the proxy compatibility patch. The last command installs and starts the Linux user service, adds the desktop launcher, enables startup at login, and opens the local manager. Omit `--enable` if login startup is unwanted. No `sudo` is needed for the companion installer.

Keep the checkout in a permanent directory: the installed service uses the absolute source and Node executable paths. After moving the checkout or removing its Node installation, rerun the installer from the new location.

You can instead install the companion before downloading tool dependencies, then use **Install / repair tools** in the GUI. Stop the MCP server before using that button. Dependency installation requires internet access.

#### Load the Chrome extension

1. Open `chrome://extensions` and enable **Developer mode**.
2. Disable any older MCP SuperAssistant installation to avoid duplicate panels.
3. Choose **Load unpacked** and select this checkout's **`dist`** directory, not the repository root.
4. Pin **Mehrdad MCP** to the Chrome toolbar, then refresh the chat tab.
5. After rebuilding, use **Reload** on the extension card and refresh the website again. Chrome may require toggling Developer mode to expose the reload control.

The extension's displayed name is **Mehrdad MCP | دستیار محلی**. Installing from this repository does not update the upstream Chrome Web Store extension.

#### Connect the local manager and tools

1. Open **Mehrdad MCP** from the application launcher, or run `mehrdad-mcp` (`~/.local/bin/mehrdad-mcp` if that directory is not in PATH).
2. In the manager, choose an existing, readable project directory and select the tool collections. Save and start MCP.
3. Open **Connection** and copy the local pairing key. Open the extension's Chrome toolbar popup and enter it in the local-manager connection field. Do not paste this key into a chat.
4. In the website's MCP sidebar, select **SSE** and set the server URI to `http://127.0.0.1:3006/sse`. Reconnect/refresh the connection and tools list.
5. With all three collections enabled, the current pinned versions expose **26 tools**.

The manager runs at `http://127.0.0.1:3007`. Opening it through the launcher signs into the panel automatically. Selecting a directory in the Chrome popup requires pairing first. Changing the workspace restarts a running MCP server and affects every connected client.

### First tool call in a chat

1. Open a supported chat website and enable the MCP interface.
2. Enable the tools you need under **Available Tools**.
3. Open the in-page **MCP** menu and select **Insert default instructions**; alternatively use the sidebar's instructions tab or copy/paste the generated prompt.
4. Send the instructions with a request such as: “Use the filesystem tool to list the allowed directories. Do not modify any files.”
5. The assistant should emit a completed tool call. Review the tool name and arguments, then click **Run / اجرا**.
6. Insert the real tool result into the conversation and send it to let the model continue.

For example, the model can emit this fenced JSONL block for a read-only check:

```jsonl
{"type":"function_call_start","name":"filesystem.list_allowed_directories","call_id":1}
{"type":"function_call_end","call_id":1}
```

Tool names and schemas must match the connected server. The generated default instructions include the enabled tools. A normal code example is not automatically a tool call. A model that ignores the instructions may need to be asked to regenerate the expected format. Refresh the default prompt after changing tool availability.

Automatic execution, result insertion, and submission are separate settings. Start with manual execution so you can inspect file operations. The model sees tool results only when they are inserted/sent into its conversation.

### Included tool collections

| Collection                  | Tools | Purpose                                                            |
| --------------------------- | ----: | ------------------------------------------------------------------ |
| Filesystem `2.2.0`          |    16 | Read, write, search, and manage files within the allowed workspace |
| Memory `2.1.0`              |     9 | Persistent entities, observations, and relationships               |
| Sequential thinking `2.1.1` |     1 | Structured reasoning steps                                         |

The manager configures these three bundled collections. A general-purpose arbitrary-MCP-server editor is not implemented. The generated `mcp-config.json` is managed by the companion and is overwritten when settings change. No shell execution tool is included by default.

Disabling a tool in the extension changes that client's available tools and prompt. Disabling a collection in the manager changes the shared server for all clients.

### Use the same tools in OpenCode

Keep the companion and MCP server running. Merge this object into your existing `opencode.json` or `opencode.jsonc`; preserve other settings:

```json
{
  "mcp": {
    "superassistant": {
      "type": "remote",
      "url": "http://127.0.0.1:3006/sse",
      "enabled": true,
      "timeout": 20000
    }
  }
}
```

Then check:

```sh
opencode mcp list
```

The entry should be connected. Ask the coding agent to use the filesystem or memory tools. The Chrome extension does not need to be open for OpenCode to use this MCP server. This connects **tools** to OpenCode; it does not turn a browser chat subscription into an OpenCode model provider. Workspace changes affect OpenCode too; reconnect if a settings change interrupts its session.

### Configuration, data, and privacy

| Item                                    | Default                                           |
| --------------------------------------- | ------------------------------------------------- |
| Manager                                 | `http://127.0.0.1:3007`                           |
| MCP SSE                                 | `http://127.0.0.1:3006/sse`                       |
| Initial workspace                       | `~/Projects/mcp-workspace`                        |
| Settings, pairing key, generated config | `~/.local/share/mehrdad-mcp/`                     |
| Persistent memory                       | `~/.local/share/mehrdad-mcp/memory.jsonl`         |
| User service                            | `~/.config/systemd/user/mehrdad-mcp.service`      |
| Launcher                                | `~/.local/bin/mehrdad-mcp`                        |
| Desktop entry                           | `~/.local/share/applications/mehrdad-mcp.desktop` |

The manager validates an existing absolute workspace path and rejects the filesystem root. MCP filesystem permissions are enforced by the filesystem server. Local settings/key files use restricted permissions. The manager API requires its pairing token and restricts accepted browser origins. **The MCP SSE endpoint has separate semantics: it is bound to loopback and does not use the manager's pairing token.** Do not expose either port publicly. Other local programs can reach the MCP endpoint.

Tool results sent to a chat are processed by that chat provider. Logs may contain local paths and tool information; review them before sharing. Upstream optional Firebase/analytics integration remains in the source and is controlled by build-time configuration; a fresh checkout does not require those credentials. Do not embed personal credentials in a public build or commit `.env`, pairing keys, memory, or private runtime data.

Advanced companion environment variables are `MCP_DATA_DIR`, `MCP_RUNTIME_DIR`, `MCP_WORKSPACE`, `MCP_MEMORY_FILE`, `MCP_MANAGER_PORT`, and `MCP_PROXY_PORT`. The extension's manager bridge currently targets port **3007**; changing that port requires a matching source change and rebuild. The sidebar's MCP URL is configurable. Installer migration options include `--runtime /absolute/path` and `--memory-file /absolute/path`; `--no-open` installs without opening a browser.

#### Manual startup without systemd

After installing companion dependencies:

```sh
node companion/server.mjs
```

Keep that terminal running. Open `http://127.0.0.1:3007` and enter the pairing key from the `pairing-token` file in the data directory shown above. Linux desktop-service installation is the supported automated path; other platforms require manual verification. Native folder selection can be unavailable; enter an absolute path instead.

### Service operations and updates

```sh
systemctl --user status mehrdad-mcp.service
systemctl --user restart mehrdad-mcp.service
journalctl --user -u mehrdad-mcp.service -f
```

The GUI shows the latest 600 in-memory log messages and supports filtering, pausing display, and download. For updates, stop the MCP server, pull reviewed changes, run `pnpm install --frozen-lockfile`, `pnpm build`, and `npm ci --prefix companion`, then restart the user service and reload the extension and chat tab. Rerun the installer if source/Node paths changed. Back up persistent memory before migrations.

To remove startup integration while retaining your checkout and data:

```sh
systemctl --user disable --now mehrdad-mcp.service
rm -f ~/.config/systemd/user/mehrdad-mcp.service
rm -f ~/.local/bin/mehrdad-mcp
rm -f ~/.local/share/applications/mehrdad-mcp.desktop
systemctl --user daemon-reload
```

Remove the extension in Chrome separately. If an older installation was migrated, inspect `~/.local/bin/mcp-superassistant.before-mehrdad` before restoring the compatibility launcher; the installer keeps backups. Data and memory are deliberately retained.

### Troubleshooting

| Symptom                         | Check / action                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connected but zero tools        | Start the MCP server, enable collections, reconnect and refresh tools. Confirm the URL ends in `/sse`. Rebuild/reload this fork rather than using the upstream extension.                 |
| Code appears without Run        | Insert the current default instructions, verify the assistant emitted a complete supported call, enable MCP, and refresh after extension reload. Ordinary code is not executable tooling. |
| `Extension context invalidated` | Refresh the chat tab after reloading/toggling the extension.                                                                                                                              |
| Manager fails to connect        | Check the user service and port 3007; use the launcher and pair the Chrome popup.                                                                                                         |
| Port already occupied           | Stop the duplicate old proxy/service. Keep only one MCP server on port 3006.                                                                                                              |
| Tools not installed             | Run `npm ci --prefix companion`, or stop MCP and use Install / repair in the manager. Review installation logs.                                                                           |
| Filesystem access denied        | Choose an existing readable workspace, save settings, reconnect the client, and use paths inside that workspace.                                                                          |
| Install/build engine error      | Use Node >=22.12 and pnpm 9.15.1 in the same terminal.                                                                                                                                    |
| Browser schema/CSP error        | Reinstall the pinned companion packages so its proxy patch runs. Do not weaken Chrome's extension security policy.                                                                        |
| Prompt/menu missing             | Enable the extension and MCP interface on the supported domain, reload the extension, then refresh the tab.                                                                               |

### Development and validation

```sh
pnpm test:extension
pnpm --filter chrome-extension --filter @extension/content-script type-check
MCP_TEST_RUNTIME="$PWD/companion" pnpm test:companion
pnpm build
git diff --check
```

The companion integration test uses temporary directories and ports **31066/31067**. Setting `MCP_TEST_RUNTIME` enables the real MCP process tests; without it, that integration case is skipped. Dependencies must already be installed in the selected runtime.

Tests cover ChatGPT/GapGPT parsing, tool cards, default-prompt insertion, the React menu, extension pairing permissions, manager authentication, parallel MCP clients, actual allowed-directory calls, workspace changes, collection selection, and shutdown. Automated DOM tests do not guarantee compatibility with every future live website layout. Current validation does not justify a claim of zero bugs.

```text
chrome-extension/     Manifest, background MCP client, pairing bridge, popup, icons
pages/content/        Website adapters, sidebar, menu, tool rendering, themes
packages/             Shared extension/build infrastructure
companion/            Local manager, installer, pinned MCP tools, integration tests
tests/                Extension and compatibility regression tests
.github/workflows/    Build and regression validation
```

Build output, dependencies, pairing keys, and personal memory are not source files and are excluded from Git. To report a bug, include the version, OS, Node/Chrome version, website, reproduction steps, and redacted logs. Contributions should preserve upstream license notices and add appropriate regression coverage.

### Credits and license

Personalization and local companion: **mehrdad hasanzade**. Original extension: **Saurabh Patel and MCP SuperAssistant contributors**. This fork is independent and is not affiliated with the supported chat providers. See [LICENSE](LICENSE) (MIT); bundled dependencies retain their own licenses.

---

## فارسی

### معرفی پروژه

**ChatToAgent** با نام نمایشی **Mehrdad MCP**، افزونهٔ Chrome و برنامهٔ مدیریت محلی برای اتصال گفتگوهای هوش مصنوعی به ابزارهای MCP است. این نسخه با رابط فارسی، راست‌به‌چپ و شخصی‌سازی برای **mehrdad hasanzade** بر پایهٔ MCP SuperAssistant ساخته شده است.

مدل در سایت چت اجرا می‌شود؛ افزونه دستورالعمل ابزارها را در اختیارش می‌گذارد، فراخوانی ساختاریافتهٔ ابزار را در پاسخ تشخیص می‌دهد و دکمهٔ **اجرا / Run** نشان می‌دهد. ابزار روی رایانه اجرا می‌شود و نتیجه را می‌توان به گفتگو برگرداند. برنامهٔ مدیریت، نصب ابزارها، پوشهٔ مجاز، روشن و خاموش‌کردن سرویس و لاگ را کنترل می‌کند.

این پروژه مدل هوش مصنوعی یا اشتراک سایت ارائه نمی‌کند. برای راه‌اندازی ابزارهای محلی کلید API مدل لازم نیست؛ حساب و شرایط استفاده از سایت چت همچنان مستقل است. اتصال به OpenCode مربوط به **ابزارهای MCP** است و اشتراک چت مرورگر را به مدل OpenCode تبدیل نمی‌کند.

### امکانات

- رابط فارسی و RTL در پنل چت، پنجرهٔ افزونه و مدیر محلی؛ آیکون اختصاصی و نام سازنده.
- تم روشن سفید و تم تیرهٔ نزدیک به مشکی با تأکید سبز نئونی.
- منوی MCP در صفحهٔ چت، درج یا کپی پرامپت پیش‌فرض، انتخاب ابزارها و کنترل اجرای خودکار.
- اصلاح تشخیص پاسخ و کارت اجرای ابزار در ChatGPT و GapGPT.
- تنظیم پوشهٔ پروژه از افزونه یا مدیر محلی، همراه با اعمال روی سرور فایل.
- نصب و تعمیر ابزارهای پایه، شروع، توقف، راه‌اندازی مجدد و نمایش و دریافت لاگ.
- استفادهٔ هم‌زمان از یک سرور در مرورگر و OpenCode.
- نصب سرویس کاربر لینوکس، میانبر دسکتاپ و فرمان اجرای پنل.

### پیش‌نیازها و وضعیت پشتیبانی

| بخش            | نیازمندی                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| Node.js        | نسخهٔ ۲۲.۱۲ یا جدیدتر؛ بررسی انتشار با Node 24 انجام می‌شود                   |
| ساخت افزونه    | pnpm نسخهٔ 9.15.1، Git، Bash و اینترنت برای دریافت بسته‌ها                    |
| مرورگر         | Chrome یا Chromium با پشتیبانی Load unpacked                                  |
| نصب خودکار     | لینوکس دسکتاپ با `systemctl --user`                                           |
| سیستم‌های دیگر | اجرای دستی سرور ممکن است؛ نصب ویندوز، مک و Firefox در این نسخه تأیید نشده است |

برای ChatGPT و `gapgpt.app` آزمون‌های اختصاصی سازگاری وجود دارد. کارکرد DeepSeek، Gemini و Perplexity توسط کاربر گزارش شده است. سایر آداپترهای نسخهٔ اصلی در سورس هستند، ولی همهٔ نسخه‌های فعلی سایت‌ها بررسی نشده‌اند. تغییر ساختار سایت می‌تواند نیازمند اصلاح آداپتر باشد. در GapGPT درج مستقیم پرامپت فعال است و میانبر پیوست فایل پشتیبانی نمی‌شود.

### نصب کامل از سورس

ابتدا Node مناسب را نصب و با `node --version` بررسی کنید. فرمان‌های زیر برای Bash در لینوکس هستند:

```sh
npm install --global pnpm@9.15.1
git clone https://github.com/Mtgama/ChatToAgent.git
cd ChatToAgent
pnpm install --frozen-lockfile
pnpm build
npm ci --prefix companion
bash companion/install.sh --enable
```

خروجی افزونه داخل **`dist/`** ساخته می‌شود. دستور `npm ci --prefix companion` نسخه‌های قفل‌شدهٔ ابزارها را نصب و اصلاح سازگاری پروکسی را اعمال می‌کند. دستور آخر سرویس کاربر، میانبر و فرمان پنل را نصب می‌کند، سرویس را اجرا کرده و پنل را باز می‌کند. برای نخواستن اجرای سرویس هنگام ورود به حساب، گزینهٔ `--enable` را حذف کنید. نصب‌کنندهٔ companion به `sudo` نیاز ندارد.

پوشهٔ پروژه را در مسیر دائمی نگه دارید؛ سرویس به مسیر مطلق سورس و فایل اجرایی Node اشاره می‌کند. پس از جابه‌جایی پروژه یا حذف نسخهٔ Node، نصب‌کننده را دوباره اجرا کنید.

روش جایگزین: ابتدا companion را نصب کنید و سپس از دکمهٔ «نصب / تعمیر ابزارهای پایه» در پنل استفاده کنید. هنگام نصب بسته‌ها، MCP باید متوقف باشد و اینترنت در دسترس باشد.

#### افزودن افزونه به Chrome

۱. آدرس `chrome://extensions` را باز و **Developer mode** را روشن کنید.

۲. نسخهٔ قبلی MCP SuperAssistant را غیرفعال کنید تا پنل تکراری ایجاد نشود.

۳. **Load unpacked** را بزنید و پوشهٔ **dist** همین پروژه را انتخاب کنید؛ پوشهٔ اصلی مخزن مناسب نیست.

۴. افزونهٔ **Mehrdad MCP** را در نوار Chrome سنجاق کنید و صفحهٔ چت را Refresh کنید.

۵. پس از هر ساخت مجدد، افزونه را از کارت آن Reload و سپس صفحهٔ چت را Refresh کنید. اگر کنترل Reload دیده نمی‌شود، وضعیت Developer mode را بررسی کنید.

نام نمایشی افزونه **Mehrdad MCP | دستیار محلی** است. این نصب محلی، نسخهٔ فروشگاه Chrome را به‌روزرسانی نمی‌کند.

#### اتصال مدیر محلی و ابزارها

۱. برنامهٔ **Mehrdad MCP** را از فهرست برنامه‌ها یا با فرمان `mehrdad-mcp` باز کنید. اگر فرمان در PATH نیست از `~/.local/bin/mehrdad-mcp` استفاده کنید.

۲. پوشهٔ پروژهٔ موجود و قابل خواندن را انتخاب کنید، مجموعه‌ابزارها را فعال کنید، تنظیمات را ذخیره و MCP را راه‌اندازی کنید.

۳. در بخش «اتصال افزونه و ایجنت» کلید اتصال را کپی کنید. روی آیکون افزونه در نوار Chrome کلیک و کلید را در بخش اتصال به مدیریت محلی وارد کنید. **کلید را در پیام چت وارد نکنید.**

۴. در پنل MCP سایت، نوع اتصال **SSE** و نشانی سرور را `http://127.0.0.1:3006/sse` قرار دهید؛ اتصال و فهرست ابزارها را تازه‌سازی کنید.

۵. با فعال‌بودن هر سه مجموعه، نسخه‌های فعلی مجموعاً **۲۶ ابزار** ارائه می‌کنند.

پنل مدیریت روی `http://127.0.0.1:3007` است. بازکردن آن از میانبر ورود خودکار انجام می‌دهد. انتخاب مسیر از پنجرهٔ Chrome به اتصال اولیه با کلید نیاز دارد. تغییر مسیر باعث راه‌اندازی دوبارهٔ MCP در حال اجرا می‌شود و روی تمام مشتریان از جمله OpenCode اثر دارد.

### اولین استفاده در چت

۱. سایت پشتیبانی‌شده را باز و رابط MCP را فعال کنید.

۲. در «ابزارهای موجود» ابزارهای لازم را فعال کنید.

۳. از دکمهٔ **MCP** داخل صفحه، «درج دستورالعمل پیش‌فرض» را انتخاب کنید؛ این امکان در بخش راهنمای سایدبار و گزینهٔ کپی هم وجود دارد.

۴. دستورالعمل را همراه درخواست روشن بفرستید؛ مثلاً: «با ابزار فایل فقط پوشه‌های مجاز را نشان بده و هیچ فایلی را تغییر نده.»

۵. مدل باید فراخوانی کامل ابزار را تولید کند. نام و پارامترها را بررسی و روی **اجرا / Run** کلیک کنید.

۶. نتیجهٔ واقعی را در گفتگو درج و ارسال کنید تا مدل بر اساس آن ادامه دهد.

نمونهٔ فراخوانی فقط‌خواندنی در بلوک JSONL:

```jsonl
{"type":"function_call_start","name":"filesystem.list_allowed_directories","call_id":1}
{"type":"function_call_end","call_id":1}
```

نام و ساختار ورودی ابزار باید با سرور یکی باشد. پرامپت پیش‌فرض از ابزارهای فعال ساخته می‌شود؛ پس از تغییر ابزارها آن را تازه کنید. هر کد معمولی کارت اجرا نمی‌سازد و مدل ممکن است به درخواست مجدد برای رعایت قالب نیاز داشته باشد.

اجرای خودکار، درج خودکار نتیجه و ارسال خودکار، تنظیمات جداگانه‌اند. برای شروع، اجرای دستی را نگه دارید تا عملیات فایل را بررسی کنید. نتیجه فقط وقتی به مدل می‌رسد که در گفتگوی آن درج و ارسال شود.

### ابزارهای همراه

| مجموعه                          | تعداد | کاربرد                                          |
| ------------------------------- | ----: | ----------------------------------------------- |
| Filesystem نسخهٔ 2.2.0          |    ۱۶ | خواندن، نوشتن، جستجو و مدیریت فایل در مسیر مجاز |
| Memory نسخهٔ 2.1.0              |     ۹ | نگه‌داری موجودیت‌ها، مشاهده‌ها و رابطه‌ها       |
| Sequential thinking نسخهٔ 2.1.1 |     ۱ | حل مسئلهٔ مرحله‌ای                              |

مدیر محلی این سه مجموعه را پیکربندی می‌کند؛ ویرایشگر عمومی برای افزودن هر سرور دلخواه MCP هنوز پیاده‌سازی نشده است. فایل `mcp-config.json` توسط برنامه تولید می‌شود و با تغییر تنظیمات بازنویسی خواهد شد. ابزار اجرای شِل به‌صورت پیش‌فرض همراه پروژه نیست.

غیرفعال‌کردن ابزار در افزونه روی همان مشتری و پرامپت آن اثر دارد؛ غیرفعال‌کردن مجموعه در مدیر محلی روی سرور مشترک تمام مشتریان اثر می‌گذارد.

### اتصال به OpenCode و ایجنت کدنویسی

مدیر محلی و MCP را روشن نگه دارید. این بخش را در فایل تنظیمات موجود `opencode.json` یا `opencode.jsonc` **ادغام** کنید؛ تنظیمات دیگر را حذف نکنید:

```json
{
  "mcp": {
    "superassistant": {
      "type": "remote",
      "url": "http://127.0.0.1:3006/sse",
      "enabled": true,
      "timeout": 20000
    }
  }
}
```

سپس بررسی کنید:

```sh
opencode mcp list
```

اتصال `superassistant` باید برقرار باشد. حالا از ایجنت بخواهید از ابزار فایل یا حافظه استفاده کند. بازبودن افزونه برای استفادهٔ OpenCode از سرور لازم نیست. این روش ابزارها را متصل می‌کند؛ مدل OpenCode را باید جداگانه انتخاب کنید. پس از تغییر پوشه یا راه‌اندازی مجدد، اگر اتصال قطع شد آن را دوباره برقرار کنید.

### مسیرها، تنظیمات و حریم خصوصی

| مورد                            | مقدار پیش‌فرض                                     |
| ------------------------------- | ------------------------------------------------- |
| مدیر محلی                       | `http://127.0.0.1:3007`                           |
| سرور MCP                        | `http://127.0.0.1:3006/sse`                       |
| پوشهٔ اولیهٔ ابزار فایل         | `~/Projects/mcp-workspace`                        |
| تنظیمات، کلید و کانفیگ تولیدشده | `~/.local/share/mehrdad-mcp/`                     |
| حافظهٔ پایدار                   | `~/.local/share/mehrdad-mcp/memory.jsonl`         |
| سرویس کاربر                     | `~/.config/systemd/user/mehrdad-mcp.service`      |
| فرمان بازکردن پنل               | `~/.local/bin/mehrdad-mcp`                        |
| میانبر برنامه                   | `~/.local/share/applications/mehrdad-mcp.desktop` |

مسیر پروژه باید مطلق، موجود و قابل خواندن باشد؛ انتخاب ریشهٔ فایل‌سیستم پذیرفته نمی‌شود. سرور فایل محدودیت مسیر مجاز را اعمال می‌کند. فایل کلید و تنظیمات دسترسی محدود دارند. API مدیریت به کلید اتصال نیاز دارد و مبدأهای مرورگر را محدود می‌کند. **خودِ سرور SSE از کلید مدیر محلی استفاده نمی‌کند و فقط روی loopback گوش می‌دهد.** این پورت‌ها را عمومی نکنید؛ برنامه‌های محلی دیگر می‌توانند به MCP وصل شوند.

نتایجی که به چت ارسال می‌کنید در اختیار ارائه‌دهندهٔ همان چت قرار می‌گیرد. لاگ ممکن است مسیر فایل و اطلاعات ابزار داشته باشد؛ قبل از اشتراک‌گذاری بررسی کنید. کد اختیاری Firebase و آمارگیر نسخهٔ اصلی در سورس باقی است و با تنظیمات زمان ساخت کنترل می‌شود؛ نصب تازه به این اعتبارنامه‌ها نیاز ندارد. `.env`، کلید اتصال، حافظه و داده‌های خصوصی نباید وارد Git یا بیلد عمومی شوند.

متغیرهای پیشرفتهٔ companion عبارت‌اند از: `MCP_DATA_DIR`، `MCP_RUNTIME_DIR`، `MCP_WORKSPACE`، `MCP_MEMORY_FILE`، `MCP_MANAGER_PORT` و `MCP_PROXY_PORT`. اتصال مدیریتی افزونه فعلاً پورت **3007** را هدف می‌گیرد؛ تغییر آن به اصلاح متناظر سورس و ساخت مجدد نیاز دارد. نشانی MCP در سایدبار قابل تنظیم است. نصب‌کننده برای مهاجرت گزینه‌های `--runtime /absolute/path` و `--memory-file /absolute/path` و برای بازنکردن مرورگر گزینهٔ `--no-open` دارد.

#### اجرای دستی بدون systemd

پس از نصب بسته‌های companion:

```sh
node companion/server.mjs
```

ترمینال را باز نگه دارید. آدرس `http://127.0.0.1:3007` را باز و کلید فایل `pairing-token` در پوشهٔ داده را وارد کنید. مسیر نصب خودکار تأییدشده، لینوکس دسکتاپ است. اگر انتخاب‌گر بومی پوشه موجود نبود، مسیر مطلق را دستی وارد کنید.

### مدیریت سرویس، به‌روزرسانی و حذف

```sh
systemctl --user status mehrdad-mcp.service
systemctl --user restart mehrdad-mcp.service
journalctl --user -u mehrdad-mcp.service -f
```

پنل ۶۰۰ پیام اخیر از شروع برنامه را نگه می‌دارد و جستجو، توقف نمایش و دریافت گزارش دارد. برای به‌روزرسانی، MCP را متوقف کنید، تغییرات بررسی‌شده را دریافت کنید و `pnpm install --frozen-lockfile`، `pnpm build` و `npm ci --prefix companion` را اجرا کنید؛ سپس سرویس را دوباره راه‌اندازی و افزونه و صفحهٔ چت را Reload/Refresh کنید. اگر مسیر سورس یا Node تغییر کرده، نصب‌کننده را دوباره اجرا کنید. قبل از مهاجرت از حافظه نسخهٔ پشتیبان بگیرید.

حذف سرویس و میانبر بدون پاک‌کردن سورس و داده:

```sh
systemctl --user disable --now mehrdad-mcp.service
rm -f ~/.config/systemd/user/mehrdad-mcp.service
rm -f ~/.local/bin/mehrdad-mcp
rm -f ~/.local/share/applications/mehrdad-mcp.desktop
systemctl --user daemon-reload
```

افزونه را جداگانه از Chrome حذف کنید. اگر نصب قدیمی مهاجرت شده است، فایل `~/.local/bin/mcp-superassistant.before-mehrdad` را قبل از بازگردانی فرمان قدیمی بررسی کنید. داده و حافظه خودکار حذف نمی‌شوند.

### رفع اشکال

| مشکل                            | بررسی و راه‌حل                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| اتصال برقرار ولی ابزار صفر است  | MCP و مجموعه‌ها را روشن کنید، نشانی `/sse` و نسخهٔ همین fork را بررسی و اتصال و فهرست را تازه کنید.                  |
| پاسخ کد است ولی Run ندارد       | پرامپت فعلی را درج کنید؛ پاسخ باید فراخوانی کامل ابزار باشد. MCP را فعال و پس از Reload افزونه صفحه را Refresh کنید. |
| `Extension context invalidated` | صفحهٔ چت را پس از Reload یا روشن و خاموش‌کردن افزونه Refresh کنید.                                                   |
| پنل مدیریت وصل نمی‌شود          | سرویس و پورت 3007 را بررسی کنید، پنل را از میانبر باز و پنجرهٔ افزونه را با کلید متصل کنید.                          |
| پورت اشغال است                  | پروکسی یا سرویس قدیمی تکراری را متوقف کنید؛ روی 3006 تنها یک سرور لازم است.                                          |
| ابزار نصب نیست                  | `npm ci --prefix companion` یا نصب / تعمیر در پنل با MCP متوقف؛ لاگ نصب را بخوانید.                                  |
| دسترسی فایل رد می‌شود           | مسیر مجازِ موجود را انتخاب و ذخیره کنید؛ مشتری را دوباره وصل و از مسیر داخل همان پوشه استفاده کنید.                  |
| خطای نسخه هنگام نصب             | Node حداقل 22.12 و pnpm 9.15.1 را در همان ترمینال بررسی کنید.                                                        |
| خطای schema یا CSP مرورگر       | بسته‌های قفل‌شدهٔ companion را مجدداً نصب کنید تا اصلاح پروکسی اعمال شود؛ سیاست امنیتی Chrome را تضعیف نکنید.        |
| پرامپت یا منو دیده نمی‌شود      | افزونه و MCP را روی دامنهٔ پشتیبانی‌شده فعال و سپس افزونه و صفحه را دوباره بارگذاری کنید.                            |

### توسعه و آزمون

```sh
pnpm test:extension
pnpm --filter chrome-extension --filter @extension/content-script type-check
MCP_TEST_RUNTIME="$PWD/companion" pnpm test:companion
pnpm build
git diff --check
```

آزمون یکپارچه از پوشه‌های موقت و پورت‌های **31066/31067** استفاده می‌کند. با تعیین `MCP_TEST_RUNTIME` تست فرایند واقعی MCP فعال می‌شود؛ بدون این متغیر آن مورد رد نمی‌شود، بلکه **اجرا نمی‌شود / skip**. بسته‌ها باید از قبل در runtime انتخابی نصب باشند.

آزمون‌ها تشخیص ChatGPT/GapGPT، کارت ابزار، درج پرامپت پیش‌فرض، منوی React، مجوز اتصال افزونه، احراز هویت مدیریت، مشتریان هم‌زمان، اجرای واقعی فهرست مسیر مجاز، تغییر پوشه، انتخاب مجموعه‌ها و توقف را می‌سنجند. آزمون DOM به معنی تضمین سازگاری با هر تغییر آیندهٔ سایت نیست؛ هیچ ادعای «بدون هیچ باگ» مطرح نمی‌شود.

ساختار سورس: `chrome-extension/` برای مانیفست و بک‌گراند و پنجرهٔ افزونه، `pages/content/` برای آداپترها و پنل و رندر ابزار، `packages/` برای زیرساخت مشترک، `companion/` برای مدیر محلی و نصب و تست‌های سرویس، و `tests/` برای آزمون‌های افزونه است. خروجی ساخت، وابستگی‌ها، کلید و حافظهٔ شخصی در Git قرار نمی‌گیرند.

برای گزارش باگ، نسخهٔ پروژه، سیستم‌عامل، Node/Chrome، سایت، مراحل تکرار و لاگ بدون اطلاعات حساس را ارائه کنید. مشارکت باید حقوق مؤلفان اصلی را حفظ کند و برای تغییرات رفتاری پوشش آزمون مناسب داشته باشد.

### اعتبار و مجوز

شخصی‌سازی و مدیر محلی: **mehrdad hasanzade**. پروژهٔ اصلی: **Saurabh Patel و مشارکت‌کنندگان MCP SuperAssistant**. این fork مستقل است و وابسته به ارائه‌دهندگان سایت‌های چت نیست. مجوز [MIT](LICENSE) و حقوق نویسندگان اصلی حفظ شده است؛ وابستگی‌ها مجوزهای خودشان را دارند.
