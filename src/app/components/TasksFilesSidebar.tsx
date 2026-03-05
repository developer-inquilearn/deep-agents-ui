"use client";

import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import {
  FileText,
  CheckCircle,
  Circle,
  Clock,
  ChevronDown,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TodoItem, FileItem } from "@/app/types/types";
import { useChatContext } from "@/providers/ChatProvider";
import { cn } from "@/lib/utils";
import { FileViewDialog } from "@/app/components/FileViewDialog";

// Parse a file path into its base name and version number.
// e.g. "/task-documents/nighttime-routine-v2.md" → { base: "nighttime-routine", version: 2 }
// Files without a version suffix get version: null.
function parseFileVersion(filePath: string): { base: string; version: number | null } {
  const fileName = filePath.split("/").pop() ?? filePath;
  const nameWithoutExt = fileName.replace(/\.md$/, "");
  const match = nameWithoutExt.match(/^(.+)-v(\d+)$/);
  if (match) {
    return { base: match[1], version: parseInt(match[2], 10) };
  }
  return { base: nameWithoutExt, version: null };
}

function extractContent(raw: unknown): string {
  if (typeof raw === "object" && raw !== null && "content" in raw) {
    const arr = (raw as { content: unknown }).content;
    return Array.isArray(arr) ? arr.join("\n") : String(arr ?? "");
  }
  return String(raw ?? "");
}

function FileButton({
  filePath,
  files,
  onSelect,
  dimmed,
}: {
  filePath: string;
  files: Record<string, string>;
  onSelect: (file: FileItem) => void;
  dimmed?: boolean;
}) {
  const fileName = filePath.split("/").pop() ?? filePath;
  const fileContent = extractContent(files[filePath]);
  return (
    <button
      type="button"
      onClick={() => onSelect({ path: filePath, content: fileContent })}
      className={cn(
        "cursor-pointer space-y-1 truncate rounded-md border border-border px-2 py-3 shadow-sm transition-colors",
        dimmed && "opacity-50"
      )}
      style={{ backgroundColor: "var(--color-file-button)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-file-button-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--color-file-button)";
      }}
    >
      <FileText size={24} className="mx-auto text-muted-foreground" />
      <span className="mx-auto block w-full truncate break-words text-center text-sm leading-relaxed text-foreground">
        {fileName}
      </span>
    </button>
  );
}

export function FilesPopover({
  files,
  setFiles,
  editDisabled,
}: {
  files: Record<string, string>;
  setFiles: (files: Record<string, string>) => Promise<void>;
  editDisabled: boolean;
}) {
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [oldVersionsOpen, setOldVersionsOpen] = useState(false);

  const handleSaveFile = useCallback(
    async (fileName: string, content: string) => {
      await setFiles({ ...files, [fileName]: content });
      setSelectedFile({ path: fileName, content: content });
    },
    [files, setFiles]
  );

  // Group files: for each base name keep only the highest version as "latest";
  // everything else goes into "older". Unversioned files are always "latest".
  const { latestFiles, olderFiles } = useMemo(() => {
    // Map base name → { path, version }[]
    const groups: Record<string, { path: string; version: number | null }[]> = {};
    for (const filePath of Object.keys(files)) {
      const { base, version } = parseFileVersion(filePath);
      if (!groups[base]) groups[base] = [];
      groups[base].push({ path: filePath, version });
    }

    const latest: string[] = [];
    const older: string[] = [];

    for (const entries of Object.values(groups)) {
      if (entries.length === 1) {
        latest.push(entries[0].path);
        continue;
      }
      // Sort descending by version (null treated as 0)
      const sorted = [...entries].sort(
        (a, b) => (b.version ?? 0) - (a.version ?? 0)
      );
      latest.push(sorted[0].path);
      older.push(...sorted.slice(1).map((e) => e.path));
    }

    return { latestFiles: latest.sort(), olderFiles: older.sort() };
  }, [files]);

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <p className="text-xs text-muted-foreground">No files created yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 p-2">
        {/* Latest versions grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
          {latestFiles.map((filePath) => (
            <FileButton
              key={filePath}
              filePath={filePath}
              files={files}
              onSelect={setSelectedFile}
            />
          ))}
        </div>

        {/* Older versions collapsible */}
        {olderFiles.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setOldVersionsOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                size={12}
                className={cn(
                  "transition-transform duration-200",
                  oldVersionsOpen ? "rotate-180" : "rotate-0"
                )}
              />
              Previous Versions ({olderFiles.length})
            </button>
            {oldVersionsOpen && (
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                {olderFiles.map((filePath) => (
                  <FileButton
                    key={filePath}
                    filePath={filePath}
                    files={files}
                    onSelect={setSelectedFile}
                    dimmed
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedFile && (
        <FileViewDialog
          file={selectedFile}
          onSaveFile={handleSaveFile}
          onClose={() => setSelectedFile(null)}
          editDisabled={editDisabled}
        />
      )}
    </>
  );
}

export const TasksFilesSidebar = React.memo<{
  todos: TodoItem[];
  files: Record<string, string>;
  setFiles: (files: Record<string, string>) => Promise<void>;
}>(({ todos, files, setFiles }) => {
  const { isLoading, interrupt } = useChatContext();
  const [tasksOpen, setTasksOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(true);

  // Track previous counts to detect when content goes from empty to having items
  const prevTodosCount = useRef(todos.length);
  const prevFilesCount = useRef(Object.keys(files).length);

  // Auto-expand when todos go from empty to having content
  useEffect(() => {
    if (prevTodosCount.current === 0 && todos.length > 0) {
      setTasksOpen(true);
    }
    prevTodosCount.current = todos.length;
  }, [todos.length]);

  // Auto-expand when files go from empty to having content
  const filesCount = Object.keys(files).length;
  useEffect(() => {
    if (prevFilesCount.current === 0 && filesCount > 0) {
      setFilesOpen(true);
    }
    prevFilesCount.current = filesCount;
  }, [filesCount]);

  const getStatusIcon = useCallback((status: TodoItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle
            size={12}
            className="text-success/80"
          />
        );
      case "in_progress":
        return (
          <Clock
            size={12}
            className="text-warning/80"
          />
        );
      default:
        return (
          <Circle
            size={10}
            className="text-tertiary/70"
          />
        );
    }
  }, []);

  const groupedTodos = useMemo(() => {
    return {
      pending: todos.filter((t) => t.status === "pending"),
      in_progress: todos.filter((t) => t.status === "in_progress"),
      completed: todos.filter((t) => t.status === "completed"),
    };
  }, [todos]);

  const groupedLabels = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
  };

  return (
    <div className="min-h-0 w-full flex-1">
      <div className="font-inter flex h-full w-full flex-col p-0">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
            <span className="text-xs font-semibold tracking-wide text-zinc-600">
              AGENT TASKS
            </span>
            <button
              onClick={() => setTasksOpen((v) => !v)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-transform duration-200 hover:bg-muted",
                tasksOpen ? "rotate-180" : "rotate-0"
              )}
              aria-label="Toggle tasks panel"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          {tasksOpen && (
            <div className="bg-muted-secondary rounded-xl px-3 pb-2">
              <ScrollArea className="h-full">
                {todos.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No tasks created yet
                    </p>
                  </div>
                ) : (
                  <div className="ml-1 p-0.5">
                    {Object.entries(groupedTodos).map(([status, todos]) => (
                      <div className="mb-4">
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                          {groupedLabels[status as keyof typeof groupedLabels]}
                        </h3>
                        {todos.map((todo, index) => (
                          <div
                            key={`${status}_${todo.id}_${index}`}
                            className="mb-1.5 flex items-start gap-2 rounded-sm p-1 text-sm"
                          >
                            {getStatusIcon(todo.status)}
                            <span className="flex-1 break-words leading-relaxed text-inherit">
                              {todo.content}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
            <span className="text-xs font-semibold tracking-wide text-zinc-600">
              FILE SYSTEM
            </span>
            <button
              onClick={() => setFilesOpen((v) => !v)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-transform duration-200 hover:bg-muted",
                filesOpen ? "rotate-180" : "rotate-0"
              )}
              aria-label="Toggle files panel"
            >
              <ChevronDown size={14} />
            </button>
          </div>
          {filesOpen && (
            <FilesPopover
              files={files}
              setFiles={setFiles}
              editDisabled={isLoading === true || interrupt !== undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
});

TasksFilesSidebar.displayName = "TasksFilesSidebar";
