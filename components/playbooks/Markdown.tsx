"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renderiza Markdown com um visual "Notion" no tema dark. GFM = tabelas,
// checklists, ~riscado~, links automáticos.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="pb-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || "_Sem conteúdo ainda._"}</ReactMarkdown>
      <style jsx global>{`
        .pb-prose { color: #d4d4d8; font-size: 15px; line-height: 1.7; }
        .pb-prose > *:first-child { margin-top: 0; }
        .pb-prose h1 { font-size: 26px; font-weight: 800; color: #fafafa; margin: 1.6em 0 .5em; letter-spacing: -.01em; }
        .pb-prose h2 { font-size: 20px; font-weight: 700; color: #fafafa; margin: 1.5em 0 .4em; padding-bottom: .25em; border-bottom: 1px solid #27272a; }
        .pb-prose h3 { font-size: 16px; font-weight: 700; color: #f4f4f5; margin: 1.3em 0 .3em; }
        .pb-prose p { margin: .6em 0; }
        .pb-prose a { color: #f5c518; text-decoration: underline; text-underline-offset: 2px; }
        .pb-prose strong { color: #fafafa; font-weight: 700; }
        .pb-prose em { color: #e4e4e7; }
        .pb-prose ul, .pb-prose ol { margin: .5em 0; padding-left: 1.4em; }
        .pb-prose li { margin: .3em 0; }
        .pb-prose ul { list-style: disc; }
        .pb-prose ol { list-style: decimal; }
        .pb-prose li::marker { color: #71717a; }
        .pb-prose input[type="checkbox"] { margin-right: .5em; accent-color: #f5c518; transform: translateY(1px); }
        .pb-prose li:has(> input[type="checkbox"]) { list-style: none; margin-left: -1.4em; }
        .pb-prose blockquote { margin: 1em 0; padding: .7em 1em; border-left: 3px solid #f5c518; background: rgba(245,197,24,.06); border-radius: 0 8px 8px 0; color: #e4e4e7; }
        .pb-prose blockquote p { margin: .2em 0; }
        .pb-prose code { background: #18181b; border: 1px solid #27272a; border-radius: 5px; padding: .1em .4em; font-size: 13px; color: #fbbf24; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .pb-prose pre { background: #0f0f11; border: 1px solid #27272a; border-radius: 10px; padding: 12px 14px; overflow-x: auto; margin: 1em 0; }
        .pb-prose pre code { background: none; border: none; padding: 0; color: #d4d4d8; }
        .pb-prose hr { border: none; border-top: 1px solid #27272a; margin: 1.6em 0; }
        .pb-prose table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; display: block; overflow-x: auto; }
        .pb-prose th, .pb-prose td { border: 1px solid #27272a; padding: 8px 10px; text-align: left; }
        .pb-prose th { background: #18181b; color: #fafafa; font-weight: 700; }
        .pb-prose img { max-width: 100%; border-radius: 10px; }
      `}</style>
    </div>
  );
}
