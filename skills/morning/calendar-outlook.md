# Calendar addon: Outlook (rooflow.json `"addons": { "calendar": "outlook" }`)

Windows only, from a session that runs as the logged-in user. Run this in the PowerShell tool (an inline command, never a `.ps1`
file) and use the output as the meeting list:

```
$ol = New-Object -ComObject Outlook.Application; $ns = $ol.GetNamespace("MAPI"); $cal = $ns.GetDefaultFolder(9).Items; $cal.IncludeRecurrences = $true; $cal.Sort("[Start]"); $d = Get-Date; $f = "[Start] >= '" + $d.ToString("yyyy-MM-dd 00:00") + "' AND [Start] <= '" + $d.ToString("yyyy-MM-dd 23:59") + "'"; $cal.Restrict($f) | Select-Object Start, End, Subject, Location | Format-Table -AutoSize
```

If it fails (no Outlook, another account, a policy), say so in one line and go on without meetings.
