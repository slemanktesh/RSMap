import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DEFAULT_CUSTOM_CACHE_PATH } from '@/lib/cacheConfig';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

export async function POST() {
  if (process.platform !== 'win32') {
    return NextResponse.json(
      { path: null, message: 'Folder browsing is only available on local Windows runs. Enter the cache path manually.' },
      { status: 400 }
    );
  }

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Select OSRS cache folder'",
    `$dialog.SelectedPath = '${escapePowerShellSingleQuotedString(DEFAULT_CUSTOM_CACHE_PATH)}'`,
    '$dialog.ShowNewFolderButton = $false',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }',
  ].join('; ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-STA',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ], {
      windowsHide: false,
      timeout: 5 * 60 * 1000,
    });

    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return NextResponse.json({ path: null, message: 'No folder selected.' });
    }

    return NextResponse.json({ path: selectedPath, message: 'Folder selected.' });
  } catch (error) {
    return NextResponse.json(
      { path: null, message: 'Could not open the folder picker. Enter the cache path manually.' },
      { status: 500 }
    );
  }
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}
