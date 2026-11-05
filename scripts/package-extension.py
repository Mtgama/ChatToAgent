"""Validate and package the production extension, with manifest.json at ZIP root."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / 'dist'
manifest = json.loads((source / 'manifest.json').read_text())
version = json.loads((root / 'package.json').read_text())['version']
if manifest['version'] != version or manifest['manifest_version'] != 3:
    raise ValueError('Manifest version does not match the release')
required = [manifest['background']['service_worker'], manifest['action']['default_popup']]
required += list(manifest['icons'].values())
for content in manifest['content_scripts']:
    required += content.get('js', []) + content.get('css', [])
for name in required:
    target = (source / name).resolve()
    if not target.is_relative_to(source.resolve()) or not target.is_file():
        raise ValueError(f'Missing or unsafe manifest entry: {name}')
output = root / 'dist-zip'
output.mkdir(exist_ok=True)
archive = output / f'ChatToAgent-Chrome-v{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for entry in sorted(source.rglob('*')):
        if entry.is_symlink():
            raise ValueError(f'Symlink in build output: {entry.name}')
        if not entry.is_file():
            continue
        relative = entry.relative_to(source)
        if entry.suffix in {'.map', '.pem', '.key'} or any(p.startswith('.') for p in relative.parts):
            raise ValueError(f'Private or development file in output: {relative}')
        bundle.write(entry, relative.as_posix())
with zipfile.ZipFile(archive) as bundle:
    if bundle.testzip() is not None or 'manifest.json' not in bundle.namelist():
        raise ValueError('Invalid extension archive')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(output / 'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n')
print(f'Validated {archive.name}: {archive.stat().st_size} bytes; SHA256 {digest}')
