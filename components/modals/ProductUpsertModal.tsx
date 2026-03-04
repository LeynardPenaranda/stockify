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
  expirationDate: string; // "" or YYYY-MM-DD
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

  // Force consistent black text + white bg for inputs (fix laptop/monitor differences)
  const inputClass = "bg-white text-gray-900 placeholder:text-gray-400";
  const dateInputClass = "bg-white text-gray-900 placeholder:text-gray-400";

  return (
    <Modal
      title={editing ? "Edit Product" : "Add Product"}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText={editing ? "Save Changes" : "Create"}
      confirmLoading={saving}
      destroyOnHidden
      style={{ top: 16 }}
      styles={{
        body: {
          maxHeight: "calc(92dvh - 120px)",
          overflowY: "auto",
          padding: 16,
        },
      }}
    >
      <div className="space-y-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Name</div>
          <Input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. Milk"
            className={inputClass}
          />
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Supplier</div>
          <Input
            value={form.supplier}
            onChange={(e) =>
              setForm((s) => ({ ...s, supplier: e.target.value }))
            }
            placeholder="e.g. ABC Trading (optional)"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Category</div>
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
            <div className="text-xs text-gray-500 mb-1">Expiration Date</div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Quantity</div>
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
            <div className="text-xs text-gray-500 mb-1">
              Minimum Stock Level
            </div>
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
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">Product Image</div>

          {editing?.imageUrl ? (
            <div className="mb-2 flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black/5">
                <Image
                  src={editing.imageUrl}
                  alt="Current product image"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs text-gray-500">
                Uploading a new image will replace the old one.
              </div>
            </div>
          ) : null}

          <Upload {...uploadProps}>
            <div>
              <PlusOutlined />
              <div className="mt-2">Upload</div>
            </div>
          </Upload>
        </div>
      </div>
    </Modal>
  );
}
