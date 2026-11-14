type AuthHeaderProps = { title: string; description?: string };

export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
