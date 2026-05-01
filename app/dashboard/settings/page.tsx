"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  User,
  Lock,
  BellRing,
  Palette,
  Shield,
  ShieldCheck,
  Trash2,
  Camera,
  Loader2,
  X,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/supabase/auth-context"
import { useUserStore } from "@/store/user-store"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

import { isSeller } from "@/lib/marketplace/roles"

export default function SettingsPage() {
  const router = useRouter()
  const { user, profile, refreshProfile, isLoading: authLoading } = useAuth()
  const { fetchPlan } = useUserStore()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  
  // Profile form state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [bio, setBio] = useState("")
  const [languages, setLanguages] = useState<string[]>([])
  const [newLanguage, setNewLanguage] = useState("")
  
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null)
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({})

  // MFA State
  const [mfaFactors, setMfaFactors] = useState<any[]>([])
  const [isMfaLoading, setIsMfaLoading] = useState(true)
  const [showMfaEnroll, setShowMfaEnroll] = useState(false)
  const [enrollData, setEnrollData] = useState<{
    qrCode?: string;
    factorId: string;
  } | null>(null)
  const [mfaOTP, setMfaOTP] = useState("")
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)
  const [mfaMode, setMfaMode] = useState<'enroll' | 'unenroll'>('enroll')

  // Account State
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const hasPasswordAccount = !!user?.app_metadata?.providers?.includes("email") || 
                             !!user?.user_metadata?.has_password

  // Real-time validation
  useEffect(() => {
    const errors: typeof passwordErrors = {}
    
    if (newPassword && newPassword.length < 6) {
      errors.new = "Password must be at least 6 characters"
    }
    
    if (confirmPassword && newPassword !== confirmPassword) {
      errors.confirm = "Passwords do not match"
    } else if (confirmPassword && newPassword === confirmPassword) {
      // Clear match error if it becomes valid
      delete errors.confirm
    }

    if (hasPasswordAccount && currentPassword && newPassword && currentPassword === newPassword) {
      errors.new = "New password must be different from current password"
    }

    setPasswordErrors(errors)
    // Clear the overall status message when they start typing fixes
    if (Object.keys(errors).length === 0 || newPassword || confirmPassword || currentPassword) {
       // Only clear if it was an error message
       setStatusMessage(prev => prev?.type === "error" ? null : prev)
    }
  }, [newPassword, confirmPassword, currentPassword, hasPasswordAccount])

  useEffect(() => {
    if (profile) {
      // Split full name into first and last name
      const names = (profile.full_name || "").split(" ")
      setFirstName(names[0] || "")
      setLastName(names.slice(1).join(" ") || "")
      setPhone(profile.phone || "")
      setBio(profile.bio || "")
      setLanguages(profile.languages || [])
    }
  }, [profile])

  useEffect(() => {
    fetchPlan()
    fetchFactors()
  }, [fetchPlan])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    if (profile && !isSeller(profile.role)) {
      router.push("/")
    }
  }, [authLoading, user, profile, router])

  const fetchFactors = async () => {
    setIsMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      setMfaFactors(data.all || [])
    } catch (error) {
      console.error("Failed to fetch MFA factors:", error)
    } finally {
      setIsMfaLoading(false)
    }
  }

  const handleEnrollMFA = async () => {
    try {
      // Cleanup: If there's an existing unverified factor, remove it first to avoid "already exists" errors
      const existingUnverified = mfaFactors.find(f => f.status === 'unverified')
      if (existingUnverified) {
        await supabase.auth.mfa.unenroll({ factorId: existingUnverified.id })
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App"
      })

      if (error) {
        // If it still says it exists, try one more cleanup before giving up
        if (error.message.includes("already exists")) {
          const { data: { factors }, error: factorsError } = await supabase.auth.mfa.listFactors()
        const verifiedFactors = factors?.filter((f: any) => f.status === 'verified') || []
          const dup = factors?.find((f: any) => f.status === 'unverified')
          if (dup) {
             await supabase.auth.mfa.unenroll({ factorId: dup.id })
             // Try enrolling again
             const retry = await supabase.auth.mfa.enroll({
               factorType: "totp",
               friendlyName: "Authenticator App"
             })
             if (retry.error) throw retry.error
             setEnrollData({ qrCode: retry.data.totp.qr_code, factorId: retry.data.id })
             setShowMfaEnroll(true)
             return
          }
        }
        throw error
      }

      setEnrollData({
        qrCode: data.totp.qr_code,
        factorId: data.id,
      })
      setMfaMode('enroll')
      setShowMfaEnroll(true)
    } catch (error) {
      console.error("Enrollment error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to initiate MFA enrollment")
    }
  }

  const handleVerifyMFA = async () => {
    const code = mfaOTP.trim()
    if (!enrollData || code.length !== 6) return
    
    setIsVerifyingMfa(true)
    
    try {
      // 1. Create Challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      })
      
      if (challengeError) throw new Error(`Challenge failed: ${challengeError.message}`)

      // 2. Verify Code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challengeData.id,
        code: code,
      })

      if (verifyError) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel !== 'aal2') {
          throw new Error(verifyError.message || "Invalid verification code.")
        }
      }

      // 3. Complete Action based on Mode
      if (mfaMode === 'unenroll') {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: enrollData.factorId
        })
        if (unenrollError) throw new Error(`Unenroll failed: ${unenrollError.message}`)
        toast.success("Two-factor authentication disabled")
      } else {
        toast.success("Two-factor authentication is now active")
      }

      // 4. Cleanup UI on success
      setIsVerifyingMfa(false)
      setShowMfaEnroll(false)
      setEnrollData(null)
      setMfaOTP("")
      
      // Update factors in the background
      fetchFactors()
    } catch (error) {
      console.error("MFA Verification sequence error:", error)
      toast.error(error instanceof Error ? error.message : "Verification failed. Please try again.")
      setIsVerifyingMfa(false)
    }
  }

  const handleUnenrollMFA = async (factorId: string) => {
    try {
      // Check current AAL level
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      
      if (aal?.currentLevel === 'aal2') {
        // Already AAL2, can unenroll directly
        if (!confirm("Are you sure you want to disable two-factor authentication?")) return
        const { error } = await supabase.auth.mfa.unenroll({ factorId })
        if (error) throw error
        toast.success("MFA disabled successfully")
        fetchFactors()
      } else {
        // At AAL1, need to verify first
        setMfaMode('unenroll')
        setEnrollData({ factorId })
        setShowMfaEnroll(true)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disable MFA")
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
      return
    }

    setIsDeletingAccount(true)
    try {
      const response = await fetch("/api/profile/delete-account", {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete account")
      }

      toast.success("Account deleted successfully")
      // Clear all local auth state and tokens before redirecting
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete account")
      setIsDeletingAccount(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview logic could go here, but we'll upload immediately for robustness
    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const uploadRes = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData,
      })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed")

      const updateRes = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: uploadData.url }),
      })

      if (!updateRes.ok) throw new Error("Failed to update profile with new avatar")

      await refreshProfile()
      toast.success("Profile photo updated successfully")
    } catch (error) {
      console.error("Avatar upload error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload photo")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return

    setIsUploading(true)
    try {
      const updateRes = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      })

      if (!updateRes.ok) throw new Error("Failed to remove avatar")

      await refreshProfile()
      toast.success("Profile photo removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove photo")
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddLanguage = () => {
    if (!newLanguage.trim()) return
    if (languages.includes(newLanguage.trim())) {
      setNewLanguage("")
      return
    }
    setLanguages([...languages, newLanguage.trim()])
    setNewLanguage("")
  }

  const handleRemoveLanguage = (lang: string) => {
    setLanguages(languages.filter((l) => l !== lang))
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    const fullName = `${firstName} ${lastName}`.trim()
    
    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          bio,
          languages,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update profile")

      await refreshProfile()
      toast.success("Profile updated successfully")
    } catch (error) {
      console.error("Profile save error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    // Final check - though button should be disabled
    if (hasPasswordAccount && !currentPassword) {
      setStatusMessage({ text: "Current password is required", type: "error" })
      return
    }
    if (newPassword.length < 6 || newPassword !== confirmPassword) {
      setStatusMessage({ text: "Please satisfy password requirements", type: "error" })
      return
    }

    setIsUpdatingPassword(true)
    try {
      if (hasPasswordAccount) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || "",
          password: currentPassword,
        })
        if (signInError) throw new Error("Incorrect current password")
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password: true } // Mark that a password has been set
      })

      if (updateError) throw updateError

      // Update local state immediately for better UX
      if (!hasPasswordAccount && user) {
        // Manually patch local user object if possible to avoid waiting for session refresh
        if (user.app_metadata) {
          if (!user.app_metadata.providers) user.app_metadata.providers = []
          if (!user.app_metadata.providers.includes("email")) {
            user.app_metadata.providers.push("email")
          }
        }
      }

      setStatusMessage({ text: "Password updated successfully!", type: "success" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      
      // Refresh context in background
      refreshProfile()
    } catch (error) {
      console.error("Password update error:", error)
      const msg = error instanceof Error ? error.message : "Failed to update password"
      setStatusMessage({ text: msg, type: "error" })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !isSeller(profile?.role)) {
    return null
  }

  return (
    <div className="max-w-4xl">
          <section className="mb-6">
            <h1 className="text-xl font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your seller account and preferences</p>
          </section>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-background border">
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Account</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <BellRing className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your profile details and public information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={profile?.avatar_url || ""} />
                        <AvatarFallback className="text-2xl">{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <Button 
                        size="icon" 
                        className="absolute bottom-0 right-0 rounded-full w-8 h-8"
                        onClick={handleAvatarClick}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      </Button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                      />
                    </div>
                    <div>
                      <h3 className="font-medium">Profile Photo</h3>
                      <p className="text-sm text-muted-foreground mb-2">JPG, GIF or PNG. Max size of 2MB.</p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleAvatarClick}
                          disabled={isUploading}
                        >
                          {isUploading ? "Uploading..." : "Upload New"}
                        </Button>
                        {profile?.avatar_url && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            onClick={handleRemoveAvatar}
                            disabled={isUploading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Form */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName" 
                        value={firstName} 
                        onChange={(e) => setFirstName(e.target.value)} 
                        placeholder="First Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName" 
                        value={lastName} 
                        onChange={(e) => setLastName(e.target.value)} 
                        placeholder="Last Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={profile?.email || ""} readOnly className="bg-muted" />
                      <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input 
                        id="phone" 
                        type="tel" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="+33 6 12 34 56 78"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                      />
                      <p className="text-xs text-muted-foreground">
                        This will be displayed on your public profile. Max 500 characters.
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Languages */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium">Languages</h3>
                      <p className="text-sm text-muted-foreground">Languages you can conduct tours in</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {languages.map((lang) => (
                        <Badge key={lang} variant="secondary" className="gap-1">
                          {lang}
                          <button 
                            className="ml-1 hover:text-destructive"
                            onClick={() => handleRemoveLanguage(lang)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      <div className="flex items-center gap-2">
                        <Input
                          size={15}
                          className="h-8 text-sm"
                          placeholder="Add language..."
                          value={newLanguage}
                          onChange={(e) => setNewLanguage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleAddLanguage()
                            }
                          }}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={handleAddLanguage}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                  {hasPasswordAccount 
                    ? "Change your existing password" 
                    : "Create a password for your account (currently using Google login)"}
                </CardDescription>
                {statusMessage && (
                  <div className={`mt-4 p-3 rounded-lg text-sm border ${
                    statusMessage.type === "success" 
                      ? "bg-secondary/10 text-secondary border-secondary/30" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}>
                    {statusMessage.text}
                  </div>
                )}
              </CardHeader>
                <CardContent className="space-y-4">
                  {hasPasswordAccount && (
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input 
                        id="currentPassword" 
                        type="password" 
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value)
                          if (passwordErrors.current) setPasswordErrors({...passwordErrors, current: undefined})
                        }}
                        placeholder="••••••••"
                        className={passwordErrors.current ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {passwordErrors.current && (
                        <p className="text-xs text-destructive font-medium">{passwordErrors.current}</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input 
                      id="newPassword" 
                      type="password" 
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value)
                        if (passwordErrors.new) setPasswordErrors({...passwordErrors, new: undefined})
                      }}
                      placeholder="••••••••"
                      className={passwordErrors.new ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {passwordErrors.new && (
                      <p className="text-xs text-destructive font-medium">{passwordErrors.new}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (passwordErrors.confirm) setPasswordErrors({...passwordErrors, confirm: undefined})
                      }}
                      placeholder="••••••••"
                      className={passwordErrors.confirm ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {passwordErrors.confirm && (
                      <p className="text-xs text-destructive font-medium">{passwordErrors.confirm}</p>
                    )}
                  </div>
                  <Button 
                    onClick={handleUpdatePassword} 
                    disabled={
                      isUpdatingPassword || 
                      !newPassword || 
                      newPassword.length < 6 || 
                      newPassword !== confirmPassword ||
                      (hasPasswordAccount && !currentPassword)
                    }
                  >
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      hasPasswordAccount ? "Update Password" : "Set Password"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>Add an extra layer of security to your account</CardDescription>
                </CardHeader>
                <CardContent>
                  {isMfaLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : mfaFactors.some(f => f.status === 'verified') ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <p className="font-medium">Authenticator App</p>
                          <p className="text-sm text-secondary">Active and protected</p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleUnenrollMFA(mfaFactors.find(f => f.status === 'verified')?.id)}
                      >
                        Disable
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <p className="font-medium">Authenticator App</p>
                          <p className="text-sm text-muted-foreground">Not configured</p>
                        </div>
                      </div>
                      <Button variant="outline" onClick={handleEnrollMFA}>Enable</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog open={showMfaEnroll} onOpenChange={(open) => {
                if (!open) {
                  setShowMfaEnroll(false)
                  setEnrollData(null)
                  setMfaOTP("")
                }
              }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {mfaMode === 'enroll' ? "Setup Authenticator App" : "Disable Two-Factor Authentication"}
                    </DialogTitle>
                    <DialogDescription>
                      {mfaMode === 'enroll' 
                        ? "Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)"
                        : "Enter the 6-digit code from your authenticator app to confirm you want to disable 2FA."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-6 py-4">
                    {mfaMode === 'enroll' && enrollData?.qrCode && (
                      <div className="p-4 bg-white rounded-xl border">
                        <img 
                          src={enrollData.qrCode} 
                          alt="MFA QR Code" 
                          className="w-48 h-48"
                        />
                      </div>
                    )}
                    <div className="w-full space-y-2 text-center">
                      <p className="text-sm font-medium">Verification Code</p>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={mfaOTP}
                          onChange={setMfaOTP}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowMfaEnroll(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleVerifyMFA}
                      disabled={mfaOTP.length !== 6 || isVerifyingMfa}
                    >
                      {isVerifyingMfa ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        mfaMode === 'enroll' ? "Verify & Activate" : "Verify & Disable"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Irreversible and destructive actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Delete Account</p>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete your account and all associated data
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Account
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Manage your email notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    {
                      title: "New Bookings",
                      description: "Get notified when someone books your tour",
                      enabled: true,
                    },
                    {
                      title: "Booking Reminders",
                      description: "Receive reminders before your upcoming tours",
                      enabled: true,
                    },
                    {
                      title: "New Messages",
                      description: "Get notified when you receive a new message",
                      enabled: true,
                    },
                    {
                      title: "New Reviews",
                      description: "Get notified when someone leaves a review",
                      enabled: true,
                    },
                    {
                      title: "Marketing Emails",
                      description: "Receive tips, product updates and promotions",
                      enabled: false,
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch defaultChecked={item.enabled} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Push Notifications</CardTitle>
                  <CardDescription>Manage your push notification preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    {
                      title: "Enable Push Notifications",
                      description: "Receive push notifications on your devices",
                      enabled: true,
                    },
                    {
                      title: "Sound",
                      description: "Play a sound for new notifications",
                      enabled: true,
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch defaultChecked={item.enabled} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Language & Region</CardTitle>
                  <CardDescription>Customize your language and regional settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select defaultValue="en">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select defaultValue="europe-paris">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="europe-paris">Europe/Paris (GMT+1)</SelectItem>
                          <SelectItem value="europe-london">Europe/London (GMT+0)</SelectItem>
                          <SelectItem value="america-new-york">America/New_York (GMT-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select defaultValue="eur">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eur">EUR (€)</SelectItem>
                          <SelectItem value="usd">USD ($)</SelectItem>
                          <SelectItem value="gbp">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date Format</Label>
                      <Select defaultValue="dmy">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize how Touricho looks for you</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                        { value: "system", label: "System" },
                      ].map((themeOption) => (
                        <button
                          key={themeOption.value}
                          onClick={() => setTheme(themeOption.value)}
                          className={`
                            p-4 rounded-lg border-2 text-center transition-colors
                            ${theme === themeOption.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                          `}
                        >
                          <p className="font-medium">{themeOption.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
    </div>
  )
}
