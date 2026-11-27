import { queryOptions } from "@tanstack/react-query";
import { getHome } from "./tmdb.functions";

export const homeQuery = queryOptions({ queryKey: ["home", 6], queryFn: () => getHome(), staleTime: 600_000 });