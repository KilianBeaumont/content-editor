interface ProprietesAVenir {
  titre: string;
  etape: number;
}

export function AVenir({ titre, etape }: ProprietesAVenir) {
  return (
    <>
      <h1>{titre}</h1>
      <p className="a-venir">Cet écran arrive à l'étape {etape} de la phase 1.</p>
    </>
  );
}
