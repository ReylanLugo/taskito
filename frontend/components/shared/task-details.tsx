"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Task } from "@/types/Tasks";
import { useState, useEffect, useRef } from "react";
import { Edit, Send } from "lucide-react";
import { PriorityLabel } from "./priority-label";
import { RootState } from "@/lib/store";
import { Button } from "../ui/button";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import TaskEditDialog from "./task-edit-dialog";
import { useAppSelector } from "@/lib/store/hooks";

export default function TaskDetails({
  children,
  task,
  addComment,
}: {
  children: React.ReactNode;
  task: Task;
  addComment: (taskId: number, comment: string) => void;
}) {
  const currentUser = useAppSelector((state: RootState) => state.auth);
  const [comment, setComment] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const usersState = useAppSelector((state: RootState) => state.users);

  const addCommentEvent = (e: React.FormEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (comment.trim() === "") return;
    try {
      addComment(task.id, comment);
    } catch (error) {
      console.error("Error adding comment:", error);
    }
    setComment("");
  };

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [task.comments]);

  return (
    <Dialog>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent
        data-testid="task-details-dialog"
        className="md:max-w-[800px] max-w-[400px] md:w-[800px] w-full"
      >
        <DialogHeader>
          <DialogTitle className="text-base">Task Details</DialogTitle>
        </DialogHeader>
        <div className="flex md:flex-row flex-col gap-4 items-center h-full md:h-[400px] w-full">
          <div className="flex flex-col gap-2 flex-1 h-full">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="title"
                className="text-lg font-semibold leading-[1.2]"
              >
                {task.title}
              </Label>
              {(task.created_by == currentUser.id ||
                currentUser.role === "admin") && <TaskEditDialog task={task} />}
            </div>
            <div className="flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">
                {task.assigned_to &&
                  (usersState.users?.find((user) => user.id === task.assigned_to)
                    ?.username ??
                    "Unknown")}
                <PriorityLabel priority={task.priority} />
              </span>
              <span
                data-testid="task-due-date"
                className="text-sm text-gray-400"
              >
                {task.due_date
                  ? new Date(task.due_date).toLocaleDateString()
                  : "No due date"}
              </span>
            </div>
            <ScrollArea className="max-h-[340px] text-gray-600 text-sm">
              <p>{task.description}</p>
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </div>
          <ScrollArea className="bg-gray-200 p-4 flex flex-col justify-end gap-2 flex-1 rounded-2xl relative">
            <div
              ref={viewportRef}
              className="flex flex-col gap-3 relative h-[368px] pb-9"
            >
              {task.comments.map((comment, index) => {
                return (
                  <div
                    key={comment.id}
                    className={`flex ${
                      index === task.comments.length - 1 && "pb-[40px]"
                    } ${
                      comment.author_id === currentUser.id
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`rounded-lg p-3 max-w-xs ${
                        comment.author_id === currentUser.id
                          ? "bg-blue-500 text-white"
                          : "bg-white"
                      }`}
                    >
                      <p>{comment.content}</p>
                      <p className="text-xs opacity-70">
                        {comment.created_at
                          ? new Date(comment.created_at).toLocaleString()
                          : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="fixed w-[350px] bottom-9 flex justify-end gap-2">
                <Input
                  id="comment"
                  type="text"
                  data-testid="comment-input"
                  placeholder="Add a comment..."
                  className="mt-auto bg-white"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button
                  data-testid="submit-comment"
                  onClick={addCommentEvent}
                  className="mt-auto"
                >
                  <Send />
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
