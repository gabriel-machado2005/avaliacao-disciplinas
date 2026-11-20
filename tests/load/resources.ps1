param([Parameter(Mandatory=$true)][string]$RoleMap)
$ErrorActionPreference = 'Stop'
$loadRoles = $RoleMap | ConvertFrom-Json
$loadProcessSamples = foreach ($loadRole in $loadRoles) {
    $loadCpu = 0.0; $loadPrivate = 0L; $loadWorkingSet = 0L; $loadMembers = @()
    foreach ($loadProcessId in $loadRole.pids) {
        $loadProcess = Get-Process -Id $loadProcessId -ErrorAction SilentlyContinue
        if ($loadProcess) {
            $loadCpu += $loadProcess.TotalProcessorTime.TotalSeconds
            $loadPrivate += $loadProcess.PrivateMemorySize64
            $loadWorkingSet += $loadProcess.WorkingSet64
            $loadMembers += [PSCustomObject]@{pid=$loadProcessId;cpuSeconds=$loadProcess.TotalProcessorTime.TotalSeconds}
        }
    }
    [PSCustomObject]@{ role=$loadRole.role; cpuSeconds=$loadCpu; privateBytes=$loadPrivate; workingSetBytes=$loadWorkingSet; members=$loadMembers }
}
$loadOs = Get-CimInstance Win32_OperatingSystem
$loadCpuTotal = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'"
[PSCustomObject]@{
    timestamp=[DateTimeOffset]::UtcNow.ToString('o')
    cores=[Environment]::ProcessorCount
    totalMemoryBytes=([long]$loadOs.TotalVisibleMemorySize * 1024)
    availableMemoryBytes=([long]$loadOs.FreePhysicalMemory * 1024)
    hostCpuPercent=$loadCpuTotal.PercentProcessorTime
    processes=@($loadProcessSamples)
} | ConvertTo-Json -Depth 6 -Compress
