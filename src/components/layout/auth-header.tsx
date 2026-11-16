type AuthHeaderProps = { title: string; description?: string };

export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="type-display">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
