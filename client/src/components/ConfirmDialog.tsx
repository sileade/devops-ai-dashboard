import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, RefreshCw, StopCircle } from "lucide-react";

type ConfirmDialogVariant = "danger" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

const variantStyles: Record<ConfirmDialogVariant, { icon: typeof AlertTriangle; iconClass: string; buttonClass: string }> = {
  danger: {
    icon: Trash2,
    iconClass: "text-red-500",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-yellow-500",
    buttonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
  },
  info: {
    icon: RefreshCw,
    iconClass: "text-blue-500",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const { icon: Icon, iconClass, buttonClass } = variantStyles[variant];

  const handleConfirm = () => {
    onConfirm();
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full bg-secondary ${iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={buttonClass}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Preset dialogs for common actions
export function ClearChatDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Clear Chat History"
      description="Are you sure you want to clear all chat messages? This action cannot be undone and all conversation history will be permanently deleted."
      confirmText="Clear History"
      variant="danger"
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}

export function DeleteContainerDialog({
  open,
  onOpenChange,
  containerName,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Container"
      description={`Are you sure you want to delete the container "${containerName}"? This action cannot be undone.`}
      confirmText="Delete Container"
      variant="danger"
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}

export function StopContainerDialog({
  open,
  onOpenChange,
  containerName,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Stop Container"
      description={`Are you sure you want to stop the container "${containerName}"? Any running processes will be terminated.`}
      confirmText="Stop Container"
      variant="warning"
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}

export function RestartContainerDialog({
  open,
  onOpenChange,
  containerName,
  onConfirm,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Restart Container"
      description={`Are you sure you want to restart the container "${containerName}"? This will briefly interrupt any running services.`}
      confirmText="Restart Container"
      variant="info"
      onConfirm={onConfirm}
      isLoading={isLoading}
    />
  );
}
