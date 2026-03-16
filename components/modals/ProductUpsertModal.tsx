"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { Input, Modal, Upload } from "antd";
import type { UploadFile, UploadProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";

type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  expirationDate: string | null;
  supplier?: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  imageFolder: string | null;
};

function safeNum(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

type FormState = {
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock: number;
  expirationDate: string;
  supplier: string;
};

type Props = {
  open: boolean;
  saving?: boolean;
  editing: Product | null;

  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;

  fileList: UploadFile[];
  setFileList: React.Dispatch<React.SetStateAction<UploadFile[]>>;

  onCancel: () => void;
  onSubmit: () => void;
};

export default function ProductUpsertModal({
  open,
  saving,
  editing,
  form,
  setForm,
  fileList,
  setFileList,
  onCancel,
  onSubmit,
}: Props) {
  const uploadProps: UploadProps = useMemo(
    () => ({
      accept: "image/*",
      listType: "picture-card",
      fileList,
      maxCount: 1,
      beforeUpload: () => false,
      onChange: ({ fileList: next }) => setFileList(next),
    }),
    [fileList, setFileList],
  );

  const inputClass = "bg-white text-[#102a4d] placeholder:text-[#102a4d]/45";
  const dateInputClass =
    "bg-white text-[#102a4d] placeholder:text-[#102a4d]/45";
  const labelClass = "mb-1 text-xs text-[#102a4d]";
  const helperTextClass = "text-xs text-[#102a4d]";

  return (
    <Modal
      title={
        <span className="font-semibold text-[#102a4d]">
          {editing ? "Edit Product" : "Add Product"}
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText={editing ? "Save Changes" : "Create"}
      confirmLoading={saving}
      destroyOnHidden
      style={{ top: 16 }}
      okButtonProps={{
        className:
          "!bg-[#102a4d] hover:!bg-[#17335e] !border-[#102a4d] hover:!border-[#17335e] !text-white !shadow-none",
      }}
      cancelButtonProps={{
        className:
          "!text-[#102a4d] !border-black/10 hover:!text-[#17335e] hover:!border-[#17335e]",
      }}
      styles={{
        body: {
          maxHeight: "calc(92dvh - 120px)",
          overflowY: "auto",
          padding: 16,
        },
      }}
    >
      <div className="space-y-3 text-[#102a4d]">
        <div>
          <div className={labelClass}>Name</div>
          <Input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Milk"
            className={inputClass}
          />
        </div>

        <div>
          <div className={labelClass}>Supplier</div>
          <Input
            value={form.supplier}
            onChange={(e) =>
              setForm((s) => ({ ...s, supplier: e.target.value }))
            }
            placeholder="e.g. ABC Trading (optional)"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className={labelClass}>Category</div>
            <Input
              value={form.category}
              onChange={(e) =>
                setForm((s) => ({ ...s, category: e.target.value }))
              }
              placeholder="e.g. Dairy"
              className={inputClass}
            />
          </div>

          <div>
            <div className={labelClass}>Expiration Date</div>
            <Input
              type="date"
              value={form.expirationDate}
              onChange={(e) =>
                setForm((s) => ({ ...s, expirationDate: e.target.value }))
              }
              className={dateInputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className={labelClass}>Quantity</div>
            <Input
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) =>
                setForm((s) => ({ ...s, quantity: safeNum(e.target.value) }))
              }
              className={inputClass}
            />
          </div>

          <div>
            <div className={labelClass}>Minimum Stock Level</div>
            <Input
              type="number"
              min={0}
              value={form.minStock}
              onChange={(e) =>
                setForm((s) => ({ ...s, minStock: safeNum(e.target.value) }))
              }
              className={inputClass}
            />
          </div>

          <div>
            <div className={labelClass}>Max Stock Level</div>
            <Input
              type="number"
              min={0}
              value={form.maxStock}
              onChange={(e) =>
                setForm((s) => ({ ...s, maxStock: safeNum(e.target.value) }))
              }
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs text-[#102a4d]">Product Image</div>

          {editing?.imageUrl ? (
            <div className="mb-2 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-black/5">
                <Image
                  src={editing.imageUrl}
                  alt="Current product image"
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className={helperTextClass}>
                Uploading a new image will replace the old one.
              </div>
            </div>
          ) : null}

          <Upload {...uploadProps}>
            <div className="text-[#102a4d]">
              <PlusOutlined />
              <div className="mt-2">Upload</div>
            </div>
          </Upload>
        </div>
      </div>
    </Modal>
  );
}
