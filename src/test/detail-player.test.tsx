import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DetailPage } from "@/components/DetailPage";
import { LandscapeCard } from "@/components/LandscapeCard";
import { MediaCard } from "@/components/MediaCard";
import type { MediaDetail } from "@/lib/tmdb.functions";
import { findLugandaStreams } from "@/lib/luganda-movies";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));

const detail = (over: Partial<MediaDetail> = {}): MediaDetail => ({
  id: 1,
  kind: "movie",
  title: "Sample Film",
  poster: null,
  backdrop: null,
  year: "2026",
  rating: 7,
  overview: "An overview.",
  genres: [],
  runtime: "120 min",
  tagline: "",
  trailerKey: null,
  cast: [],
  similar: [],
  ...over,
});

describe("Unavailable playback", () => {
  it("says the title is not yet available when Play Movie is clicked", async () => {
    render(<DetailPage d={detail()} rows={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /play movie/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Movie not yet available");
  });

  it("says the trailer is not yet available when no trailer exists", async () => {
    render(<DetailPage d={detail()} rows={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /watch trailer/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Trailer not yet available");
  });

  it("plays the trailer when one exists", async () => {
    render(<DetailPage d={detail({ trailerKey: "abc123" })} rows={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /watch trailer/i }));

    expect(screen.getByTitle("Sample Film trailer")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/abc123"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Luganda movie playback", () => {
  it("matches a Luganda translated movie by title and year and streams the mp4", async () => {
    render(<DetailPage d={detail({ title: "Dr. Dolittle 2", year: "2001" })} rows={[]} />);

    expect(screen.getByText(/Luganda • VJ Emmy/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /play movie/i }));

    const video = screen.getByTitle("Dr. Dolittle 2 (VJ Emmy)");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", expect.stringContaining(".mp4"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not mismatch a remake from a different decade", () => {
    expect(findLugandaStreams("Dr. Dolittle 2", "2024")).toHaveLength(0);
  });

  it("allows switching between multiple VJs when available", async () => {
    render(<DetailPage d={detail({ title: "Evil Dead Rise", year: "2023" })} rows={[]} />);

    await userEvent.click(screen.getByRole("button", { name: /play movie/i }));
    expect(screen.getByTitle("Evil Dead Rise (VJ Junior)")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "VJ Emmy" }));
    expect(screen.getByTitle("Evil Dead Rise (VJ Emmy)")).toBeInTheDocument();
  });

  it("matches subtitle-extended and multi-part Luganda titles cleanly", () => {
    expect(findLugandaStreams("Puss in Boots: The Last Wish", "2022")[0]?.vj).toBe("VJ Kevo");
    const gotg = findLugandaStreams("Guardians of the Galaxy Vol. 3", "2023");
    expect(gotg.map((s) => s.vj)).toEqual(["VJ Junior · Part 1", "VJ Junior · Part 2"]);
  });

  it("keeps Translated below the title and puts the VJ pill inside the thumbnail on translated cards", () => {
    const { rerender } = render(
      <LandscapeCard m={detail({ title: "Dr. Dolittle 2", year: "2001" })} />,
    );
    const label = screen.getByText("Translated");
    expect(label).toBeInTheDocument();
    expect(label.closest(".poster-frame")).toBeNull();
    const pill = screen.getByText("VJ Emmy");
    expect(pill).toHaveClass("vj-pill");
    expect(pill.closest(".poster-frame")).not.toBeNull();

    rerender(
      <LandscapeCard
        m={detail({ title: "Unknown Film", year: "2026", lugandaVj: "Luganda Translated" })}
      />,
    );
    expect(screen.getByText("Translated")).toBeInTheDocument();
    expect(document.querySelector(".vj-pill")).toBeNull();

    rerender(<LandscapeCard m={detail({ title: "Upcoming Cinema Release", year: "2026" })} />);
    expect(screen.queryByText(/^Translated/i)).not.toBeInTheDocument();
    expect(document.querySelector(".vj-pill")).toBeNull();
  });

  it("keeps Translated below the title and puts the VJ pill inside the thumbnail on vertical poster cards", () => {
    render(<MediaCard m={detail({ title: "Dr. Dolittle 2", year: "2001" })} />);
    const label = screen.getByText("Translated");
    expect(label).toBeInTheDocument();
    expect(label.closest(".poster-frame")).toBeNull();
    const pill = screen.getByText("VJ Emmy");
    expect(pill).toHaveClass("vj-pill");
    expect(pill.closest(".poster-frame")).not.toBeNull();
  });
});
