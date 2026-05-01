"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Camera, Bell, Lock, Globe, CreditCard, Trash2, Loader2, ShieldCheck, Shield, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
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
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { LoadingSpinner } from "@/components/loading-spinner"
import { toast } from "sonner"

export default function ProfileSettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { user, session, profile, isLoading, refreshProfile } = useAuth()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
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

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    marketing: false,
    bookingReminders: true,
    reviewRequests: true,
    newTours: false,
  })

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/login")
      return
    }

    if (!isLoading && profile) {
      const fullName = profile.full_name || ""
      const [firstName, ...lastNameParts] = fullName.split(" ")

      setFormData({
        firstName: firstName || "",
        lastName: lastNameParts.join(" ") || "",
        email: profile.email || "",
        phone: profile.phone || "",
        location: profile.city || "", 
        bio: profile.bio || "",
      })
    }
  }, [isLoading, session, profile, router])

  useEffect(() => {
    fetchFactors()
  }, [])

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

  const hasPasswordAccount = !!user?.app_metadata?.providers?.includes("email") || 
                             !!user?.user_metadata?.has_password

  // Real-time password validation
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
       setStatusMessage(prev => prev?.type === "error" ? null : prev)
    }
  }, [newPassword, confirmPassword, currentPassword, hasPasswordAccount])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB")
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to upload avatar")
      }

      const result = await response.json()
      
      const updateRes = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: result.url }),
      })

      if (!updateRes.ok) throw new Error("Failed to update profile with new avatar")

      await refreshProfile()
      toast.success("Profile photo updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
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

  const handleProfileSubmit = async () => {
    setIsSaving(true)
    try {
      const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(" ")
      
      const payload = {
        full_name: fullName,
        phone: formData.phone,
        bio: formData.bio,
        city: formData.location // Map location setting back into city/location
      }

      const response = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update profile")
      }

      await refreshProfile()
      toast.success("Profile updated successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile")
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
      await refreshProfile()
    } catch (error) {
      console.error("Password update error:", error)
      const msg = error instanceof Error ? error.message : "Failed to update password"
      setStatusMessage({ text: msg, type: "error" })
    } finally {
      setIsUpdatingPassword(false)
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

  if (isLoading) {
    return (
      <div className="landing-template min-h-screen flex items-center justify-center bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session || !profile) {
    return null
  }

  return (
    <div className="landing-template min-h-screen bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
      <Navbar variant="landingTemplate" />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 pt-24 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex items-center gap-4 mb-8">
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="dashboard-pill-btn">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">Account Settings</h1>
            <p className="text-[color:var(--landing-muted)]">Manage your profile and preferences</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="max-w-4xl mx-auto">
          <TabsList className="mb-8 grid w-full grid-cols-4 rounded-full border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-1">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details and public profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden">
                      <Image
                        src={profile.avatar_url || "/placeholder.svg"}
                        alt={profile.full_name || "Profile"}
                        width={96}
                        height={96}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <button 
                      onClick={handleAvatarClick}
                      disabled={isUploading}
                      className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
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
                        className="bg-transparent"
                        onClick={handleAvatarClick}
                        disabled={isUploading}
                      >
                        {isUploading ? "Uploading..." : "Change Photo"}
                      </Button>
                      {profile.avatar_url && (
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

                {/* Name */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={formData.email} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support.</p>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input 
                    id="location" 
                    value={formData.location} 
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="E.g. New York, USA" 
                  />
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    className="min-h-[100px]"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Brief description for your profile. Max 300 characters.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleProfileSubmit}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Choose how you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Booking Reminders</p>
                      <p className="text-sm text-muted-foreground">Get reminded about upcoming tours</p>
                    </div>
                    <Switch
                      checked={notifications.bookingReminders}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, bookingReminders: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Review Requests</p>
                      <p className="text-sm text-muted-foreground">Receive reminders to leave reviews after tours</p>
                    </div>
                    <Switch
                      checked={notifications.reviewRequests}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, reviewRequests: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Tours in Your Cities</p>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new tours are added to cities you have visited
                      </p>
                    </div>
                    <Switch
                      checked={notifications.newTours}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, newTours: checked })}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Marketing Emails</p>
                      <p className="text-sm text-muted-foreground">Receive promotional offers and newsletters</p>
                    </div>
                    <Switch
                      checked={notifications.marketing}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, marketing: checked })}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button>Save Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Password
                  </CardTitle>
                  <CardDescription>
                    {hasPasswordAccount 
                      ? "Change your existing password" 
                      : "Create a password for your account (currently disabled if using Google login)"}
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
                        onChange={(e) => setCurrentPassword(e.target.value)}
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
                      onChange={(e) => setNewPassword(e.target.value)}
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
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={passwordErrors.confirm ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {passwordErrors.confirm && (
                      <p className="text-xs text-destructive font-medium">{passwordErrors.confirm}</p>
                    )}
                  </div>
                  <div className="flex justify-end pt-2">
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
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
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
                        className="text-destructive hover:text-destructive bg-transparent"
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
                      <Button variant="outline" className="bg-transparent" onClick={handleEnrollMFA}>
                        Enable 2FA
                      </Button>
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
                      <div className="flex justify-center flex-col items-center">
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

              <Card className="dashboard-card border-destructive/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" />
                    Delete Account
                  </CardTitle>
                  <CardDescription>Permanently delete your account and all data</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Once you delete your account, there is no going back. All your data, bookings, and reviews will be
                    permanently removed.
                  </p>
                  <Button variant="destructive" onClick={() => {
                    // Similar to the guide side deleting
                    if (confirm("Are you absolutely sure you want to delete your account? This cannot be undone.")) {
                      fetch("/api/profile/delete-account", { method: "DELETE" })
                        .then(res => res.json())
                        .then(async (data) => {
                          if (data.error) throw new Error(data.error);
                          toast.success("Account deleted");
                          await supabase.auth.signOut();
                          window.location.href = "/";
                        })
                        .catch(err => toast.error(err.message));
                    }
                  }}>Delete Account</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <div className="space-y-6">
              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Language & Region
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select defaultValue="en">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="it">Italian</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select defaultValue="usd">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usd">USD ($)</SelectItem>
                          <SelectItem value="eur">EUR (€)</SelectItem>
                          <SelectItem value="gbp">GBP (£)</SelectItem>
                          <SelectItem value="cad">CAD ($)</SelectItem>
                          <SelectItem value="aud">AUD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select defaultValue="america_new_york">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="america_new_york">Eastern Time (ET)</SelectItem>
                        <SelectItem value="america_chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="america_denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="america_los_angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="europe_london">London (GMT)</SelectItem>
                        <SelectItem value="europe_paris">Paris (CET)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription>Manage your saved payment methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No payment methods saved</h3>
                    <p className="text-muted-foreground text-sm mb-4">Add a payment method for faster booking</p>
                    <Button variant="outline" className="bg-transparent">
                      Add Payment Method
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="dashboard-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Appearance
                  </CardTitle>
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

              <div className="flex justify-end">
                <Button>Save All Preferences</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer variant="landingTemplate" />
    </div>
  )
}
