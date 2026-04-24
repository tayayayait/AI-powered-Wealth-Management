import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Globe, Lock, RefreshCw, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getOrCreateProfileSummary } from "@/lib/profile";

const WITHDRAW_CONFIRM_TEXT = "탈퇴합니다";

export const Route = createFileRoute("/_authenticated/mypage")({
  component: MyPage,
});

function MyPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const profile = await getOrCreateProfileSummary(user);
      setDisplayName(profile?.display_name ?? "");
    };

    void loadProfile();
    setCreatedAt(user.created_at ?? null);
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);

    if (error) {
      toast.error(`프로필 저장 실패: ${error.message}`);
      return;
    }

    toast.success("프로필이 저장되었습니다.");
  };

  const changePassword = async () => {
    if (newPw.length < 8) {
      toast.error("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (!/[a-zA-Z]/.test(newPw) || !/\d/.test(newPw)) {
      toast.error("비밀번호는 영문과 숫자를 모두 포함해야 합니다.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      toast.error(`비밀번호 변경 실패: ${error.message}`);
      return;
    }

    setNewPw("");
    toast.success("비밀번호가 변경되었습니다.");
  };

  const handleWithdraw = async () => {
    if (!user) return;

    if (confirmDelete !== WITHDRAW_CONFIRM_TEXT) {
      toast.error(`확인 문구를 정확히 입력하세요: ${WITHDRAW_CONFIRM_TEXT}`);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ status: "suspended", display_name: "[탈퇴회원]" })
      .eq("id", user.id);

    if (error) {
      toast.error(`탈퇴 처리 실패: ${error.message}`);
      return;
    }

    await signOut();
    toast.success("탈퇴 처리가 완료되었습니다.");
    navigate({ to: "/" });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-xl font-bold">마이페이지</h1>

      <div className="surface-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gold" />
          <div className="font-display font-semibold">프로필</div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>이메일</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>

          <div className="space-y-1.5">
            <Label>표시 이름</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">가입일</div>
            <div className="mt-1 num">
              {createdAt ? new Date(createdAt).toLocaleDateString("ko-KR") : "-"}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">최근 로그인</div>
            <div className="mt-1 num">
              {user?.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleString("ko-KR")
                : "-"}
            </div>
          </div>
        </div>

        <Button onClick={saveProfile}>저장</Button>
      </div>

      <div className="surface-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gold" />
          <div className="font-display font-semibold">설정</div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">기본 통화</div>
            <div className="mt-1 font-medium">KRW (원)</div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              데이터 새로고침 주기
            </div>
            <div className="mt-1 font-medium">5분 (TanStack Query)</div>
          </div>
        </div>
      </div>

      <div className="surface-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gold" />
          <div className="font-display font-semibold">비밀번호 변경</div>
        </div>

        <div className="space-y-1.5">
          <Label>
            새 비밀번호 <span className="text-xs text-muted-foreground">(8자 이상, 영문+숫자)</span>
          </Label>
          <Input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="새 비밀번호"
          />
        </div>

        <Button variant="outline" onClick={changePassword}>
          변경
        </Button>
      </div>

      <div className="surface-card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <div className="font-display font-semibold">계정 관리</div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            로그아웃
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">회원 탈퇴</Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>회원 탈퇴</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>탈퇴 시 계정은 정지 상태로 전환됩니다.</p>
                  <p>
                    계속하려면 아래에 <strong>{WITHDRAW_CONFIRM_TEXT}</strong> 를 입력하세요.
                  </p>
                  <Input
                    value={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.value)}
                    placeholder={WITHDRAW_CONFIRM_TEXT}
                    className="mt-2"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmDelete("")}>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleWithdraw}
                  disabled={confirmDelete !== WITHDRAW_CONFIRM_TEXT}
                  className="bg-destructive text-destructive-foreground"
                >
                  탈퇴
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
