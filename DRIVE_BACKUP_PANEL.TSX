import { useState, useCallback } from "react"
import { useKV } from "@github/spark/hooks"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  GoogleDriveLogo,
  CloudArrowUp,
  CloudArrowDown,
  Clock,
  Trash,
  CheckCircle,
  WarningCircle,
  CircleNotch,
  Link,
  LinkBreak,
  GearSix,
} from "@phosphor-icons/react"
import { DriveSetupInstructions } from "./DriveSetupInstructions"

declare global {
  interface Window {
    google: any
    gapi: any
  }
}

interface DriveBackupPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BackupMetadata {
  id: string
  fileName: string
  timestamp: number
  size: number
  layersCount: number
  notesCount: number
  highlightsCount: number
  collectionsCount: number
  driveFileId?: string
}

interface DriveAuthState {
  isAuthenticated: boolean
  userEmail: string | null
  expiresAt: number | null
}

export function DriveBackupPanel({ open, onOpenChange }: DriveBackupPanelProps) {
  const [authState, setAuthState] = useKV<DriveAuthState>("drive-auth-state", {
    isAuthenticated: false,
    userEmail: null,
    expiresAt: null,
  })
  const [backupHistory, setBackupHistory] = useKV<BackupMetadata[]>("backup-history", [])
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [autoBackupEnabled, setAutoBackupEnabled] = useKV<boolean>("auto-backup-enabled", false)
  const [lastAutoBackup, setLastAutoBackup] = useKV<number | null>("last-auto-backup", null)

  const GOOGLE_CLIENT_ID = "141991853902-g7ds6taokgdtuk3s543ldp5b7erpmnrk.apps.googleusercontent.com"
  const GOOGLE_API_KEY = "AIzaSyD-LE8l6K6aRw2HjJO_Mo2Swl_T4h2HxU0"
  const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file"

  const isConfigured = GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" 
    && GOOGLE_API_KEY !== "YOUR_GOOGLE_API_KEY"

  const isTokenExpired = useCallback(() => {
    if (!authState?.expiresAt) return true
    return Date.now() > authState.expiresAt
  }, [authState])

  const handleConnectDrive = useCallback(async () => {
    try {
      toast.info("Opening Google authentication...")
      
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response: any) => {
          if (response.error) {
            toast.error("Failed to connect to Google Drive")
            return
          }

          const expiresAt = Date.now() + (response.expires_in * 1000)
          
          setAuthState({
            isAuthenticated: true,
            userEmail: response.email || "Connected",
            expiresAt,
          })

          toast.success("Connected to Google Drive!")
        },
      })

      tokenClient.requestAccessToken()
    } catch (error) {
      console.error("Drive auth error:", error)
      toast.error("Failed to connect to Google Drive")
    }
  }, [GOOGLE_CLIENT_ID, GOOGLE_SCOPES, setAuthState])

  const handleDisconnectDrive = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      userEmail: null,
      expiresAt: null,
    })
    toast.success("Disconnected from Google Drive")
  }, [setAuthState])

  const collectAppData = useCallback(async () => {
    const layers = await window.spark.kv.get<any[]>("layers")
    const collections = await window.spark.kv.get<any[]>("bookmark-collections")
    const bookmarks = await window.spark.kv.get<Record<string, any[]>>("bookmarks-by-collection")
    const activeLayerId = await window.spark.kv.get<string>("active-layer-id")
    const pinnedSlots = await window.spark.kv.get<any>("pinned-slots")
    const noteCollapseMode = await window.spark.kv.get<string>("note-collapse-mode")

    const appData = {
      version: "1.0",
      timestamp: Date.now(),
      data: {
        layers: layers || [],
        activeLayerId,
        collections: collections || [],
        bookmarks: bookmarks || {},
        pinnedSlots,
        noteCollapseMode,
      },
    }

    return appData
  }, [])

  const calculateDataStats = useCallback((data: any) => {
    const layers = data.data?.layers || []
    const collections = data.data?.collections || []
    
    let totalNotes = 0
    let totalHighlights = 0
    
    layers.forEach((layer: any) => {
      totalNotes += layer.notes?.length || 0
      totalHighlights += layer.highlights?.length || 0
    })

    return {
      layersCount: layers.length,
      notesCount: totalNotes,
      highlightsCount: totalHighlights,
      collectionsCount: collections.length,
    }
  }, [])

  const handleBackupToDrive = useCallback(async () => {
    if (isTokenExpired()) {
      toast.error("Please reconnect to Google Drive")
      return
    }

    setIsBackingUp(true)

    try {
      const appData = await collectAppData()
      const stats = calculateDataStats(appData)
      const jsonData = JSON.stringify(appData, null, 2)
      const blob = new Blob([jsonData], { type: "application/json" })
      
      const fileName = `highlighter-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
      
      const metadata = {
        name: fileName,
        mimeType: "application/json",
        parents: ["appDataFolder"],
      }

      const form = new FormData()
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
      form.append("file", blob)

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${window.gapi?.auth?.getToken()?.access_token || "PLACEHOLDER_TOKEN"}`,
        },
        body: form,
      })

      if (!response.ok) {
        throw new Error("Failed to upload to Drive")
      }

      const result = await response.json()

      const backupMeta: BackupMetadata = {
        id: `backup-${Date.now()}`,
        fileName,
        timestamp: Date.now(),
        size: jsonData.length,
        driveFileId: result.id,
        ...stats,
      }

      setBackupHistory((current = []) => [backupMeta, ...current].slice(0, 10))
      setLastAutoBackup(Date.now())
      
      toast.success("Backup saved to Google Drive!")
    } catch (error) {
      console.error("Backup error:", error)
      toast.error("Failed to backup to Google Drive")
    } finally {
      setIsBackingUp(false)
    }
  }, [isTokenExpired, collectAppData, calculateDataStats, setBackupHistory, setLastAutoBackup])

  const handleRestoreFromDrive = useCallback(async (backup: BackupMetadata) => {
    if (isTokenExpired()) {
      toast.error("Please reconnect to Google Drive")
      return
    }

    if (!backup.driveFileId) {
      toast.error("Backup file not found in Drive")
      return
    }

    setIsRestoring(true)

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${backup.driveFileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${window.gapi?.auth?.getToken()?.access_token || "PLACEHOLDER_TOKEN"}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("Failed to download from Drive")
      }

      const appData = await response.json()

      if (appData.version !== "1.0") {
        toast.error("Incompatible backup version")
        return
      }

      await window.spark.kv.set("layers", appData.data.layers)
      await window.spark.kv.set("active-layer-id", appData.data.activeLayerId)
      await window.spark.kv.set("bookmark-collections", appData.data.collections)
      await window.spark.kv.set("bookmarks-by-collection", appData.data.bookmarks)
      
      if (appData.data.pinnedSlots) {
        await window.spark.kv.set("pinned-slots", appData.data.pinnedSlots)
      }
      if (appData.data.noteCollapseMode) {
        await window.spark.kv.set("note-collapse-mode", appData.data.noteCollapseMode)
      }

      toast.success("Data restored successfully! Please refresh the page.")
      
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error("Restore error:", error)
      toast.error("Failed to restore from Google Drive")
    } finally {
      setIsRestoring(false)
    }
  }, [isTokenExpired])

  const handleDeleteBackup = useCallback((backupId: string) => {
    setBackupHistory((current = []) => current.filter((b) => b.id !== backupId))
    toast.success("Backup removed from history")
  }, [setBackupHistory])

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const getTimeSinceLastBackup = () => {
    if (!lastAutoBackup) return "Never"
    const hours = Math.floor((Date.now() - lastAutoBackup) / (1000 * 60 * 60))
    if (hours < 1) return "Less than an hour ago"
    if (hours === 1) return "1 hour ago"
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    return days === 1 ? "1 day ago" : `${days} days ago`
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GoogleDriveLogo weight="fill" className="w-5 h-5 text-[#4285F4]" />
            Google Drive Backup
          </SheetTitle>
          <SheetDescription>
            Backup and restore your highlights, notes, and collections
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {!isConfigured && (
              <DriveSetupInstructions />
            )}
            
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Connection Status</h3>
                  <div className="flex items-center gap-2 text-sm">
                    {authState?.isAuthenticated && !isTokenExpired() ? (
                      <>
                        <CheckCircle weight="fill" className="w-4 h-4 text-green-500" />
                        <span className="text-muted-foreground">
                          {authState.userEmail || "Connected"}
                        </span>
                      </>
                    ) : (
                      <>
                        <WarningCircle weight="fill" className="w-4 h-4 text-amber-500" />
                        <span className="text-muted-foreground">Not connected</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  {authState?.isAuthenticated && !isTokenExpired() ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDisconnectDrive}
                      className="gap-2"
                    >
                      <LinkBreak className="w-4 h-4" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleConnectDrive}
                      disabled={!isConfigured}
                      className="gap-2"
                    >
                      <Link className="w-4 h-4" />
                      Connect Drive
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Backup Actions</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={handleBackupToDrive}
                      disabled={!authState?.isAuthenticated || isTokenExpired() || isBackingUp}
                      className="w-full gap-2 justify-start"
                    >
                      {isBackingUp ? (
                        <CircleNotch className="w-4 h-4 animate-spin" />
                      ) : (
                        <CloudArrowUp className="w-4 h-4" />
                      )}
                      {isBackingUp ? "Backing up..." : "Backup Now"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Auto Backup</h4>
                      <p className="text-xs text-muted-foreground">
                        Automatically backup on changes
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={autoBackupEnabled ? "default" : "outline"}
                      onClick={() => setAutoBackupEnabled((current) => !current)}
                      className="gap-2"
                    >
                      <GearSix className="w-4 h-4" />
                      {autoBackupEnabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                  {autoBackupEnabled && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Last backup: {getTimeSinceLastBackup()}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Backup History</h3>
                <Badge variant="secondary">
                  {backupHistory?.length || 0} backups
                </Badge>
              </div>

              {!backupHistory || backupHistory.length === 0 ? (
                <Card className="p-8 text-center">
                  <CloudArrowUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">
                    No backups yet. Create your first backup to get started.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {backupHistory.map((backup) => (
                    <Card key={backup.id} className="p-3 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm mb-1">
                            {backup.fileName}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDate(backup.timestamp)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="outline" className="text-xs">
                          {backup.layersCount} layers
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {backup.notesCount} notes
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {backup.highlightsCount} highlights
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {backup.collectionsCount} collections
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {formatBytes(backup.size)}
                        </Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreFromDrive(backup)}
                          disabled={!authState?.isAuthenticated || isTokenExpired() || isRestoring}
                          className="flex-1 gap-2"
                        >
                          {isRestoring ? (
                            <CircleNotch className="w-3 h-3 animate-spin" />
                          ) : (
                            <CloudArrowDown className="w-3 h-3" />
                          )}
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="gap-2"
                        >
                          <Trash className="w-3 h-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Card className="p-4 bg-muted/50">
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">How it works:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Connect your Google account to enable backup</li>
                  <li>Backups are stored privately in your Google Drive</li>
                  <li>Restore any backup to recover your data</li>
                  <li>Enable auto-backup to protect your work automatically</li>
                </ul>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
