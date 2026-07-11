'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { AppHeader } from '@/components/app/app-header';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Upload, Moon, Bell, AtSign, Volume2, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import type { UserSettings } from '@/lib/types';

const AVATAR_PRESETS = [
  '', // no avatar (use initials)
  'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200',
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200',
];

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const router = useRouter();
  const { user, setUser, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.settings.get().then(({ settings }) => setSettings(settings)).catch(() => {});
    // load full profile for bio
    fetch('/api/auth/me').then(async (r) => {
      const data = await r.json();
      if (data.user) {
        setDisplayName(data.user.display_name ?? '');
        setBio(data.user.bio ?? '');
        setAvatarUrl(data.user.avatar_url ?? '');
      }
    });
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const { user } = await api.auth.updateProfile({ display_name: displayName, bio, avatar_url: avatarUrl || undefined });
      setUser(user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAccount() {
    if (!currentPassword) { toast.error('Enter your current password'); return; }
    if (!newUsername && !newPassword) { toast.error('Enter a new username or password'); return; }
    setSavingAccount(true);
    try {
      const { user } = await api.auth.updateAccount({
        current_password: currentPassword,
        new_username: newUsername || undefined,
        new_password: newPassword || undefined,
      });
      setUser(user);
      setCurrentPassword(''); setNewUsername(''); setNewPassword('');
      toast.success('Account updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setSavingAccount(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.auth.deleteAccount({ password: deletePassword });
      toast.success('Account deleted');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  }

  async function updateSetting(key: keyof UserSettings, value: boolean) {
    if (!settings) return;
    if (key === 'dark_mode') {
      setTheme(value ? 'dark' : 'light');
    }
    setSettings({ ...settings, [key]: value });
    try {
      await api.settings.update({ [key]: value });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save setting');
      setSettings(settings);
      if (key === 'dark_mode') setTheme(!value ? 'dark' : 'light');
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error('Image too large (max 2MB)'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const { url } = await api.upload({ data_url: dataUrl, type: file.type, name: file.name });
        setAvatarUrl(url);
      } catch {
        toast.error('Upload failed');
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => router.push('/home')} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* Profile section */}
        <Card className="mb-6 p-6 animate-slide-up">
          <h2 className="mb-4 text-lg font-semibold">Profile</h2>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-2xl">{user?.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />
                <span className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Upload className="h-3 w-3" /> Change
                </span>
              </label>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setAvatarUrl(url)}
                    className={`h-10 w-10 rounded-full overflow-hidden border-2 transition-all ${avatarUrl === url ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'}`}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center text-xs font-medium">
                        {user?.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">About / Bio</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Tell people about yourself..." />
              <p className="text-xs text-muted-foreground">{bio.length}/300</p>
            </div>
            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </Card>

        {/* Account section */}
        <Card className="mb-6 p-6 animate-slide-up">
          <h2 className="mb-1 text-lg font-semibold">Account</h2>
          <p className="mb-4 text-sm text-muted-foreground">Change your username or password. Requires your current password.</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_pw">Current password</Label>
              <Input id="current_pw" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_username">New username (optional)</Label>
                <Input id="new_username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder={user?.username} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_pw">New password (optional)</Label>
                <Input id="new_pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <Button onClick={saveAccount} disabled={savingAccount}>
              {savingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update account
            </Button>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="mb-6 p-6 animate-slide-up">
          <h2 className="mb-4 text-lg font-semibold">Preferences</h2>
          <div className="space-y-1">
            <SettingRow icon={<Moon className="h-5 w-5" />} title="Dark mode" subtitle="Switch between light and dark themes">
              <Switch checked={theme === 'dark'} onCheckedChange={(v) => updateSetting('dark_mode', v)} />
            </SettingRow>
            <SettingRow icon={<Bell className="h-5 w-5" />} title="Desktop notifications" subtitle="Show browser notifications for new activity">
              <Switch checked={settings?.desktop_notifications ?? true} onCheckedChange={(v) => updateSetting('desktop_notifications', v)} />
            </SettingRow>
            <SettingRow icon={<AtSign className="h-5 w-5" />} title="Mention notifications" subtitle="Notify me when someone mentions me">
              <Switch checked={settings?.mention_notifications ?? true} onCheckedChange={(v) => updateSetting('mention_notifications', v)} />
            </SettingRow>
            <SettingRow icon={<Volume2 className="h-5 w-5" />} title="Sound" subtitle="Play sounds for new messages">
              <Switch checked={settings?.sound_enabled ?? true} onCheckedChange={(v) => updateSetting('sound_enabled', v)} />
            </SettingRow>
          </div>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30 p-6 animate-slide-up">
          <h2 className="mb-1 text-lg font-semibold text-destructive">Danger zone</h2>
          <p className="mb-4 text-sm text-muted-foreground">Permanently delete your account and all your data. This cannot be undone.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account, messages, and room memberships. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="del_pw">Enter your password to confirm</Label>
                <Input id="del_pw" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} autoComplete="current-password" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletePassword('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAccount}
                  disabled={deleting || !deletePassword}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
    </div>
  );
}

function SettingRow({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-lg p-3 hover:bg-muted/30 transition-colors">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}
