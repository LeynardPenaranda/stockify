"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Button,
  Spin,
  Upload,
  Image as AntImage,
} from "antd";
import type { GetProp, UploadFile, UploadProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import NextImage from "next/image";
import { auth, db } from "@/src/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/src/hooks/useToast";
import UpdateAdminNameModal from "./modals/UpdateAdminNameModal";

const { Title } = Typography;

type AdminDoc = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  createdAt?: any;
  createdBy?: string | null;
  photoURL?: string | null;
  photoPublicId?: string | null;
  updatedAt?: any;
};

type FileType = Parameters<GetProp<UploadProps, "beforeUpload">>[0];

const getBase64 = (file: FileType): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file as any);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

function formatTimestamp(ts: any) {
  try {
    const d: Date =
      typeof ts?.toDate === "function" ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

async function getCreatorEmail(creatorUid: string): Promise<string> {
  const ref = doc(db, "admins", creatorUid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as {
      email?: string | null;
      displayName?: string | null;
    };
    return data.email || data.displayName || creatorUid;
  }
  return creatorUid;
}

/**  Column format: label on top, value below */
function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={[
        "px-4 sm:px-6 py-3 sm:py-4",
        !isLast ? "border-b border-gray-200" : "",
        "flex flex-col gap-1",
      ].join(" ")}
    >
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="font-medium text-gray-800 text-sm wrap-break-word">
        {value}
      </span>
    </div>
  );
}

export default function AdminProfileDrawer() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [admin, setAdmin] = useState<AdminDoc | null>(null);
  const [creatorEmail, setCreatorEmail] = useState("—");

  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdmin(null);
        setLoading(false);
        return;
      }
      await loadAdmin(user.uid);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdmin(uid: string) {
    setLoading(true);
    try {
      const ref = doc(db, "admins", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setAdmin(null);
        return;
      }

      const data = snap.data() as AdminDoc;
      setAdmin(data);

      if (data.createdBy) {
        const email = await getCreatorEmail(data.createdBy);
        setCreatorEmail(email);
      } else {
        setCreatorEmail("—");
      }
    } finally {
      setLoading(false);
    }
  }

  const squareSrc = admin?.photoURL || "/images/default-admin.png";

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview && file.originFileObj) {
      file.preview = await getBase64(file.originFileObj as FileType);
    }
    setPreviewImage((file.url as string) || (file.preview as string) || "");
    setPreviewOpen(true);
  };

  const handleChange: UploadProps["onChange"] = ({ fileList: newList }) => {
    setFileList(newList.slice(-1));
  };

  const beforeUpload: UploadProps["beforeUpload"] = (file) => {
    if (!file.type?.startsWith("image/")) {
      showToast({
        type: "danger",
        message: "Invalid file",
        description: "Please select an image file.",
      });
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  const uploadButton = (
    <button style={{ border: 0, background: "none" }} type="button">
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>Select</div>
    </button>
  );

  async function onConfirmUpload() {
    const user = auth.currentUser;
    if (!user) {
      showToast({ type: "danger", message: "Not logged in" });
      return;
    }

    const selected = fileList?.[0]?.originFileObj as File | undefined;
    if (!selected) {
      showToast({ type: "warning", message: "Select an image first" });
      return;
    }

    setSavingPhoto(true);

    try {
      const token = await user.getIdToken(true);

      const form = new FormData();
      form.append("file", selected);

      const res = await fetch("/api/admin/profile/upload-photo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update photo");

      showToast({ type: "success", message: "Profile photo updated" });
      setFileList([]);
      await loadAdmin(user.uid);
    } catch (err: any) {
      showToast({
        type: "danger",
        message: "Upload failed",
        description: err?.message ?? "Something went wrong",
      });
    } finally {
      setSavingPhoto(false);
    }
  }

  async function onSaveName(newName: string) {
    const user = auth.currentUser;
    if (!user) {
      showToast({ type: "danger", message: "Not logged in" });
      return;
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      showToast({ type: "warning", message: "Name is required" });
      return;
    }
    if (trimmed.length > 60) {
      showToast({
        type: "warning",
        message: "Name too long",
        description: "Max 60 characters.",
      });
      return;
    }

    setSavingName(true);
    try {
      const token = await user.getIdToken(true);

      const res = await fetch("/api/admin/profile/update-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update name");

      showToast({ type: "success", message: "Name updated" });
      setEditOpen(false);
      await loadAdmin(user.uid);
    } catch (err: any) {
      showToast({
        type: "danger",
        message: "Update failed",
        description: err?.message ?? "Something went wrong",
      });
    } finally {
      setSavingName(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <Spin />
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="w-full p-2 sm:p-4">
      <div className="mx-auto max-w-4xl">
        <Card>
          {/*  Column layout (no LEFT/RIGHT split) */}
          <div className="flex flex-col gap-6">
            {/* TOP: Photo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative overflow-hidden rounded-lg border w-36 h-36 sm:w-44 sm:h-44">
                <NextImage
                  key={squareSrc}
                  src={squareSrc}
                  alt="Admin profile"
                  fill
                  sizes="(max-width: 640px) 144px, 176px"
                  style={{ objectFit: "cover" }}
                />
              </div>

              <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <Upload
                  listType="picture-circle"
                  fileList={fileList}
                  onPreview={handlePreview}
                  onChange={handleChange}
                  beforeUpload={beforeUpload}
                  maxCount={1}
                  multiple={false}
                  accept="image/*"
                >
                  {fileList.length >= 1 ? null : uploadButton}
                </Upload>

                <Button
                  type="primary"
                  onClick={onConfirmUpload}
                  loading={savingPhoto}
                  disabled={fileList.length === 0}
                  style={{ width: "100%" }}
                >
                  Confirm upload
                </Button>
              </div>

              {previewImage && (
                <AntImage
                  styles={{ root: { display: "none" } }}
                  preview={{
                    open: previewOpen,
                    onOpenChange: (visible) => setPreviewOpen(visible),
                    afterOpenChange: (visible) =>
                      !visible && setPreviewImage(""),
                  }}
                  src={previewImage}
                />
              )}
            </div>

            {/* BOTTOM: Info */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <Title level={4} style={{ marginBottom: 0 }}>
                  Profile Information
                </Title>

                <Button onClick={() => setEditOpen(true)}>Edit name</Button>
              </div>

              <div className="mt-4 rounded-lg border bg-white">
                <DetailRow label="Name" value={admin.displayName || "—"} />
                <DetailRow label="Email account" value={admin.email || "—"} />
                <DetailRow label="Role" value={admin.role || "—"} />
                <DetailRow
                  label="Created at"
                  value={formatTimestamp(admin.createdAt)}
                />
                <DetailRow
                  label="Updated at"
                  value={formatTimestamp(admin.updatedAt)}
                />
                <DetailRow label="Created by" value={creatorEmail} isLast />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <UpdateAdminNameModal
        open={editOpen}
        loading={savingName}
        initialName={admin.displayName ?? ""}
        onClose={() => {
          if (!savingName) setEditOpen(false);
        }}
        onSave={onSaveName}
      />
    </div>
  );
}
