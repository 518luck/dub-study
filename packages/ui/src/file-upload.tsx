/**
 * ============================================================================
 * FileUpload —— 通用文件上传组件（拖拽 + 点击 + 校验 + 压缩 + 预览）
 * ============================================================================
 *
 * 【一句话定位】
 *   一个集成了「拖拽上传 / 点击上传 / 文件类型与大小校验 / 图片自动压缩 / 预览」
 *   的可复用上传区域。纯原生实现，零第三方上传库依赖。
 *
 * 【文件结构（自上而下 4 个区块）】
 *   1. 受支持的文件格式表：acceptFileTypes
 *      -> 白名单式定义，集中管理「每种格式允许的 MIME + 报错文案」，加新类型只改这里
 *   2. 外观变体：imageUploadVariants (cva)
 *      -> default（带边框阴影）/ plain（无边框，由外部自定义形状，如圆形头像）
 *   3. Props 类型：FileUploadReadFileProps（联合类型）+ FileUploadProps
 *      -> 核心是 readFile 的「辨别联合类型」：传 true 时 onChange 强制带 src（base64 预览），
 *         不传时只回传 File 对象（交给后端处理），TS 自动约束
 *   4. 组件本体：FileUpload
 *      -> 状态：dragActive（是否正在拖入）、fileName（用于强制刷新 input）
 *      -> 心脏：onFileChange（见下方流程）
 *
 * 【核心流程：onFileChange —— 文件进来后的 5 步流水线】
 *   用户拖入 / 点击选择 file
 *      │
 *      ① 取出文件：区分「拖拽」(e.dataTransfer.files) 与「点击」(e.target.files)
 *      ② 校验大小：file.size > maxFileSizeMB -> toast 报错并 return
 *      ③ 校验类型：file.type 不在 acceptFileTypes 白名单 -> toast 报错并 return
 *      ④ （可选）图片压缩：传了 targetResolution 时，resizeImage 压缩后重新生成 File
 *      ⑤ 回调 onChange：
 *           • readFile=true  -> FileReader 读成 base64 src，连同 file 一起回传（用于即时预览）
 *           • readFile=false -> 只回传 file 对象
 *
 * 【视觉分层（z-index 从上到下）】
 *   - loading 遮罩层      z-5（白色覆盖 + 转圈，上传中显示）
 *   - 拖拽事件透明层       z-5（铺满整个区域，承接 onDrop/onDragOver 等事件）
 *   - 提示/图标层          z-3（上传图标 + 文案；有 imageSrc 时默认透明，hover 才露出「换图」遮罩）
 *   - 预览层              imageSrc 直接渲染 <img> 或 customPreview
 *   - 隐藏 input          sr-only（仅暴露给屏幕阅读器；clickToUpload 时才挂载）
 *
 * 【几个值得学习的小技巧】
 *   - <input key={fileName}>：上传后用文件名当 key 强制重建 input，
 *     否则连续选同一个文件不会触发 onChange（input 认为值没变）
 *   - 拖拽事件必须 preventDefault + stopPropagation：否则浏览器会直接打开文件
 *   - sr-only input + 可见 <label>：点击区域其实是 label，触发隐藏 input 选文件，无障碍友好
 * ============================================================================
 */
import { cn, resizeImage } from "@dub/utils";
import { VariantProps, cva } from "class-variance-authority";
import { DragEvent, ReactNode, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, Icon, LoadingCircle } from "./icons";

type AcceptedFileFormats =
  | "any"
  | "images"
  | "csv"
  | "documents"
  | "programResourceImages"
  | "programResourceFiles";

const documentTypes = [
  "application/pdf", // .pdf
  "text/plain", // .txt
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv", // .csv
];

const acceptFileTypes: Record<
  AcceptedFileFormats,
  { types: string[]; errorMessage?: string }
> = {
  any: { types: [] },
  images: {
    types: ["image/png", "image/jpeg"],
    errorMessage: "File type not supported (.png or .jpg only)",
  },
  csv: {
    types: ["text/csv"],
    errorMessage: "File type not supported (.csv only)",
  },
  documents: {
    types: documentTypes,
    errorMessage: "File type not supported (document files only)",
  },
  // TODO: allow custom `accept` prop so we don't need specific options here
  programResourceImages: {
    types: ["image/svg+xml", "image/png", "image/jpeg", "image/webp"],
    errorMessage: "File type not supported (.svg, .png, .jpg, or .webp only)",
  },
  programResourceFiles: {
    types: [...documentTypes, "application/zip"],
    errorMessage: "File type not supported (document or zip files only)",
  },
};

const imageUploadVariants = cva(
  "group relative isolate flex aspect-[1200/630] w-full flex-col items-center justify-center overflow-hidden bg-white transition-all hover:bg-neutral-50",
  {
    variants: {
      variant: {
        default: "rounded-md border border-neutral-300 shadow-sm",
        plain: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type FileUploadReadFileProps =
  | {
      /**
       * Whether to automatically read the file and return the result as `src` to onChange
       */
      readFile?: false;
      onChange?: (data: { file: File }) => void;
    }
  | {
      /**
       * Whether to automatically read the file and return the result as `src` to onChange
       */
      readFile: true;
      onChange?: (data: { file: File; src: string }) => void;
    };

export type FileUploadProps = FileUploadReadFileProps & {
  id?: string;
  accept: AcceptedFileFormats;
  className?: string;
  iconClassName?: string;
  previewClassName?: string;

  icon?: Icon;

  /**
   * Custom preview component to display instead of the default
   */
  customPreview?: ReactNode;
  /**
   * Image to display (generally for image uploads)
   */
  imageSrc?: string | null;

  /**
   * Whether to display a loading spinner
   */
  loading?: boolean;

  /**
   * Whether to allow clicking on the area to upload
   */
  clickToUpload?: boolean;

  /**
   * Whether to show instruction overlay when hovered
   */
  showHoverOverlay?: boolean;

  /**
   * Content to display below the upload icon (null to only display the icon)
   */
  content?: ReactNode | null;

  /**
   * Desired resolution to suggest and optionally resize to
   */
  targetResolution?: { width: number; height: number };

  /**
   * A maximum file size (in megabytes) to check upon file selection. Default is 5MB.
   */
  maxFileSizeMB?: number;

  /**
   * Accessibility label for screen readers
   */
  accessibilityLabel?: string;

  disabled?: boolean;
} & VariantProps<typeof imageUploadVariants>;

export function FileUpload({
  id,
  readFile,
  onChange,
  variant,
  className,
  iconClassName,
  previewClassName,
  icon: Icon = CloudUpload,
  customPreview,
  accept = "any",
  imageSrc,
  loading = false,
  clickToUpload = true,
  showHoverOverlay = true,
  content,
  maxFileSizeMB = 5,
  targetResolution,
  accessibilityLabel = "File upload",
  disabled = false,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFileChange = async (
    e: React.ChangeEvent<HTMLInputElement> | DragEvent,
  ) => {
    // ① 取出文件：拖拽用 e.dataTransfer.files，点击 input 用 e.target.files
    const file =
      "dataTransfer" in e
        ? e.dataTransfer.files && e.dataTransfer.files[0]
        : e.target.files && e.target.files[0];
    if (!file) return;

    setFileName(file.name); // 记下文件名，用作隐藏 input 的 key（强制重建，便于重复选同一文件）

    // ② 校验大小：换算成 MB 后超过 maxFileSizeMB（默认 5MB）就报错返回
    if (maxFileSizeMB > 0 && file.size / 1024 / 1024 > maxFileSizeMB) {
      toast.error(`File size too big (max ${maxFileSizeMB} MB)`);
      return;
    }

    // ③ 校验类型：file.type 必须在 accept 对应的白名单里，否则报错返回
    const acceptedTypes = acceptFileTypes[accept].types;

    if (acceptedTypes.length && !acceptedTypes.includes(file.type)) {
      toast.error(
        acceptFileTypes[accept].errorMessage ?? "File type not supported",
      );
      return;
    }

    let fileToUse = file;

    // ④ （可选）图片压缩：传了 targetResolution 且是图片时，按目标分辨率压缩后重新生成 File
    // Add image resizing logic
    if (targetResolution && file.type.startsWith("image/")) {
      try {
        const resizedFile = await resizeImage(file, targetResolution);
        const blob = await fetch(resizedFile).then((r) => r.blob());
        fileToUse = new File([blob], file.name, { type: file.type });
      } catch (error) {
        console.error("Error resizing image:", error);
        // 压缩失败时降级使用原始文件
        // Fallback to original file if resize fails
      }
    }

    // ⑤ 回调 onChange，分两种模式：
    //    readFile=true  -> 读成 base64 src 一并回传（用于即时预览）
    //    readFile=false -> 只回传 file 对象（交给后端处理）
    // File reading logic
    if (readFile) {
      const reader = new FileReader();
      reader.onload = (e) =>
        onChange?.({ src: e.target?.result as string, file: fileToUse });
      reader.readAsDataURL(fileToUse);
      return;
    }

    onChange?.({ file: fileToUse });
  };

  return (
    <label
      className={cn(
        imageUploadVariants({ variant }),
        !disabled
          ? cn(clickToUpload && "cursor-pointer")
          : "cursor-not-allowed",
        className,
      )}
    >
      {loading && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center rounded-[inherit] bg-white">
          <LoadingCircle />
        </div>
      )}
      <div
        className="absolute inset-0 z-[5]"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          onFileChange(e);
          setDragActive(false);
        }}
      />
      <div
        className={cn(
          "absolute inset-0 z-[3] flex flex-col items-center justify-center rounded-[inherit] border-2 border-transparent bg-white transition-all",
          disabled && "bg-neutral-50",
          dragActive &&
            !disabled &&
            "cursor-copy border-black bg-neutral-50 opacity-100",
          imageSrc
            ? cn(
                "opacity-0",
                showHoverOverlay && !disabled && "group-hover:opacity-100",
              )
            : cn(!disabled && "group-hover:bg-neutral-50"),
        )}
      >
        <Icon
          className={cn(
            "size-7 transition-all duration-75",
            !disabled
              ? cn(
                  "text-neutral-500 group-hover:scale-110 group-active:scale-95",
                  dragActive ? "scale-110" : "scale-100",
                )
              : "text-neutral-400",
            iconClassName,
          )}
        />
        {content !== null && (
          <div
            className={cn(
              "mt-2 text-center text-sm text-neutral-500",
              disabled && "text-neutral-400",
            )}
          >
            {content ?? (
              <>
                <p>Drag and drop {clickToUpload && "or click"} to upload.</p>
              </>
            )}
          </div>
        )}
        <span className="sr-only">{accessibilityLabel}</span>
      </div>
      {imageSrc &&
        (customPreview ?? (
          <img
            src={imageSrc}
            alt="Preview"
            className={cn(
              "h-full w-full rounded-[inherit] object-cover",
              previewClassName,
            )}
          />
        ))}
      {clickToUpload && (
        <div className="sr-only mt-1 flex shadow-sm">
          <input
            id={id}
            key={fileName} // Gets us a fresh input every time a file is uploaded
            type="file"
            accept={acceptFileTypes[accept].types.join(",")}
            onChange={onFileChange}
            disabled={disabled}
          />
        </div>
      )}
    </label>
  );
}
