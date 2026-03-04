"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, Input } from "antd";

type Props = {
  open: boolean;
  loading?: boolean;
  initialName?: string;
  onClose: () => void;
  onSave: (newName: string) => void | Promise<void>;
};

export default function UpdateAdminNameModal({
  open,
  loading = false,
  initialName = "",
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setTouched(false);
    }
  }, [open, initialName]);

  const trimmed = useMemo(() => name.trim(), [name]);
  const tooLong = trimmed.length > 60;
  const invalid = trimmed.length === 0 || tooLong;

  return (
    <Modal
      title="Update name"
      open={open}
      onCancel={() => {
        if (!loading) onClose();
      }}
      okText="Save"
      cancelText="Cancel"
      okButtonProps={{ disabled: invalid, loading }}
      cancelButtonProps={{ disabled: loading }}
      destroyOnHidden
      onOk={async () => {
        setTouched(true);
        if (invalid) return;
        await onSave(trimmed);
      }}
    >
      <div className="flex flex-col gap-2">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setTouched(true);
          }}
          placeholder="Enter display name"
          maxLength={80}
          disabled={loading}
          autoFocus
        />

        <div className="flex items-center justify-between text-xs">
          <span className={tooLong ? "text-red-600" : "text-gray-500"}>
            {tooLong
              ? "Max 60 characters."
              : "Tip: Use your full name (e.g., Juan Dela Cruz)."}
          </span>
          <span className={tooLong ? "text-red-600" : "text-gray-400"}>
            {trimmed.length}/60
          </span>
        </div>
      </div>
    </Modal>
  );
}
