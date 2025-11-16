"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { marked } from "marked";
import Latex from "react-latex-next";
import "katex/dist/katex.min.css";

export type MessageProps = ComponentProps<"div"> & {
  from: "user" | "assistant";
};

export const Message = ({ className, from, children, ...props }: MessageProps) => (
  <div
    className={cn(
      "bf-chat-slideover__message",
      from === "assistant"
        ? "bf-chat-slideover__message--assistant"
        : "bf-chat-slideover__message--user",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageContentProps = ComponentProps<"div"> & {
  content?: string;
  markdown?: boolean;
};

export const MessageContent = ({
  className,
  content,
  markdown = false,
  children,
  ...props
}: MessageContentProps) => {
  if (markdown && content) {
    // Process markdown first, then wrap with Latex component
    // The Latex component will handle both the HTML and any LaTeX expressions
    const html = marked(content) as string;
    
    return (
      <div className={className} {...props}>
        <Latex>{html}</Latex>
      </div>
    );
  }

  if (content) {
    return (
      <div className={className} {...props}>
        <Latex>{content}</Latex>
      </div>
    );
  }

  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
};