import { useQuery } from "@tanstack/react-query";

type BrandingResponse = {
  data?: {
    logoUrl: string | null;
  };
};

export function useBranding() {
  return useQuery<BrandingResponse>({
    queryKey: ["/api/branding"],
    queryFn: async () => {
      const response = await fetch("/api/branding");
      if (!response.ok) {
        throw new Error("Failed to load branding");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
