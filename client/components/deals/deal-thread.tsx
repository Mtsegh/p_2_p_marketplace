"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchDealMessages, postDealMessage } from "@/lib/deals-api";

/**
 * A deal's message thread. Only the deal's buyer and seller may read or post;
 * the API enforces participant access. Messages load oldest-first with a
 * "Load older" control for long threads.
 */
export function DealThread({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useInfiniteQuery({
    queryKey: ["deal-messages", dealId],
    queryFn: ({ pageParam }) => fetchDealMessages(dealId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const mutation = useMutation({
    mutationFn: (message: string) => postDealMessage(dealId, message),
    onSuccess: () => {
      setBody("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["deal-messages", dealId] });
    },
    onError: (caught) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not send your message.",
      );
    },
  });

  if (!user) {
    return null;
  }

  const messages = query.data?.pages.flatMap((page) => page.messages) ?? [];

  return (
    <section aria-labelledby="thread-heading">
      <h2 id="thread-heading" className="text-lg font-semibold">
        Messages
      </h2>
      <p className="mt-1 text-sm text-muted">
        Arrange the handoff here. Only you and the other participant can read
        these messages.
      </p>

      {error ? (
        <Alert tone="danger" title="Could not send message">
          {error}
        </Alert>
      ) : null}

      {query.isLoading ? (
        <p className="mt-4 text-muted">Loading messages…</p>
      ) : null}

      {query.isError ? (
        <Alert tone="danger" title="Could not load messages">
          Check your connection and try again.
        </Alert>
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {messages.map((message) => {
          const mine = message.senderId === user.id;

          return (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                mine
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-surface-raised"
              }`}
            >
              <p className="whitespace-pre-line text-sm">{message.body}</p>
              <time className="mt-1 block text-xs opacity-70">
                {new Date(message.createdAt).toLocaleString("en-US")}
              </time>
            </li>
          );
        })}
      </ul>

      {query.hasNextPage ? (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
            disabled={query.isFetchingNextPage}
          >
            Load older
          </Button>
        </div>
      ) : null}

      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = body.trim();
          if (text) mutation.mutate(text);
        }}
      >
        <TextField
          label="Your message"
          placeholder="Where should we meet?"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <div>
          <Button type="submit" loading={mutation.isPending} disabled={!body.trim() || mutation.isPending}>
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}
