export const mehrdadStyles = `
.sidebar.mehrdad-sidebar{--mehrdad-bg:#fff;--mehrdad-panel:#fff;--mehrdad-line:#dce3dd;--mehrdad-text:#1c2920;--mehrdad-muted:#58665c;--mehrdad-accent:#197137;--mehrdad-soft:#eaf7ed;font-family:Vazirmatn,Tahoma,"Segoe UI",sans-serif!important;direction:rtl;background:var(--mehrdad-bg)!important;color:var(--mehrdad-text)!important;box-shadow:-8px 0 32px #0002!important;backdrop-filter:none}
.dark .sidebar.mehrdad-sidebar,.dark.sidebar.mehrdad-sidebar{--mehrdad-bg:#0b100c;--mehrdad-panel:#101812;--mehrdad-line:#2b3c2d;--mehrdad-text:#edf9ed;--mehrdad-muted:#a5b7a7;--mehrdad-accent:#39ff14;--mehrdad-soft:#19321b}
.mehrdad-sidebar [class*="bg-slate-"],.mehrdad-sidebar [class*="bg-white"]{background-color:var(--mehrdad-panel)!important}
.mehrdad-sidebar [class*="border-slate-"]{border-color:var(--mehrdad-line)!important}
.mehrdad-sidebar [class*="text-slate-"]{color:var(--mehrdad-text)!important}
.mehrdad-sidebar [class*="text-indigo-"],.mehrdad-sidebar [class*="text-blue-"],.mehrdad-sidebar [class*="text-green-"]{color:var(--mehrdad-accent)!important}
.mehrdad-sidebar [class*="border-indigo-"]{border-color:var(--mehrdad-accent)!important}
.mehrdad-sidebar [class*="bg-indigo-"],.mehrdad-sidebar [class*="bg-blue-"]{background-color:var(--mehrdad-soft)!important}
.mehrdad-sidebar button{font-family:inherit;min-height:32px;transition:background-color .15s ease,opacity .15s ease}
.mehrdad-sidebar button:focus-visible,.mehrdad-sidebar input:focus-visible,.mehrdad-sidebar textarea:focus-visible,.mehrdad-sidebar select:focus-visible{outline:2px solid var(--mehrdad-accent);outline-offset:2px}
.mehrdad-sidebar .sidebar-header{padding:18px 16px!important;box-shadow:none!important;gap:10px}
.mehrdad-sidebar .mehrdad-brand{display:flex;gap:10px;align-items:center;color:var(--mehrdad-text);border:0;background:none;padding:0;text-align:right;min-width:0}
.mehrdad-brand strong{display:block;font:700 17px/1.5 "Segoe UI",sans-serif}.mehrdad-brand small{display:block;font:10px/1.5 "Segoe UI",sans-serif;color:var(--mehrdad-muted)}
.mehrdad-sidebar [class*="space-x-"]{column-gap:8px}.mehrdad-sidebar [class*="space-x-"]>*{margin-left:0!important;margin-right:0!important}
.mehrdad-sidebar pre,.mehrdad-sidebar code{direction:ltr;text-align:left;unicode-bidi:plaintext}.mehrdad-sidebar input{accent-color:var(--mehrdad-accent)}
.mehrdad-sidebar .sidebar-card,.mehrdad-sidebar [class*="shadow-"]{box-shadow:none!important}
.mehrdad-workspace,.mehrdad-server{padding:14px;border:1px solid var(--mehrdad-line);border-radius:10px;background:var(--mehrdad-panel);font-size:12px}
.mehrdad-workspace h3{font-size:14px;font-weight:700;margin:0 0 10px}.mehrdad-workspace p,.mehrdad-server p{color:var(--mehrdad-muted);font-size:11px;line-height:1.9;margin:6px 0}
.mehrdad-workspace input,.mehrdad-connection-form input,.mehrdad-connection-form select{display:block;width:100%;padding:9px;margin:7px 0 12px;border:1px solid var(--mehrdad-line);border-radius:7px;background:var(--mehrdad-bg);color:var(--mehrdad-text);font:12px/1.7 Tahoma,sans-serif;min-width:0}
.mehrdad-workspace button,.mehrdad-server button{border:1px solid var(--mehrdad-line);border-radius:7px;padding:7px 10px;background:var(--mehrdad-soft);color:var(--mehrdad-accent);cursor:pointer;font-size:11px}
.mehrdad-workspace button:disabled,.mehrdad-server button:disabled{opacity:.4;cursor:wait}
.mehrdad-actions{display:flex;gap:7px;align-items:center}.mehrdad-server-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.mehrdad-connected{color:var(--mehrdad-accent)}.mehrdad-connection-form{margin-top:12px}
.mehrdad-sidebar .mehrdad-credit{color:var(--mehrdad-muted);font-size:10px;text-align:center;padding:10px}
@media(prefers-reduced-motion:reduce){.mehrdad-sidebar,.mehrdad-sidebar *{animation:none!important;transition:none!important}}
`;
