import { PageSkeleton } from "@/components/loaders";
import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-8">
      <PageSkeleton cards={0} rows={3} />
    </Container>
  );
}
