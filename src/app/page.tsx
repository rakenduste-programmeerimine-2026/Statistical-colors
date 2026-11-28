import { UploadForm } from "@/components/upload/UploadForm";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-225 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Värvi tükeldaja</h1>
      <p className="mb-4 mt-2 text-lg text-muted">
        Laadi üles pilt ja saa täpne ülevaade kõigist kasutatud värvidest ja nende osakaalust – ilma ümardamiseta.
      </p>
      <UploadForm />
    </main>
  );
}
