"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roleLabels, memberRoles, type MemberRole } from "@/features/tenancy/roles";

import { updateMember } from "../actions";
import { MemberUnitsDialog } from "./member-units-dialog";
import type { MemberRow } from "../queries";

type MembersTableProps = {
  members: MemberRow[];
  currentUserId: string;
  currentRole: MemberRole;
  units: { id: string; name: string }[];
};

export function MembersTable({ members, currentUserId, currentRole, units }: MembersTableProps) {
  const [error, setError] = useState<string | null>(null);
  const [unitsMember, setUnitsMember] = useState<{ id: string; name: string; unitIds: string[] } | null>(null);
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const showUnits = units.length > 1;
  const [pending, startTransition] = useTransition();

  function run(input: Parameters<typeof updateMember>[0]) {
    setError(null);
    startTransition(async () => {
      const result = await updateMember(input);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <div className="overflow-hidden rounded-xl border">
        <Table aria-busy={pending}>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Pessoa</TableHead>
              <TableHead>Papel</TableHead>
              {showUnits ? <TableHead className="hidden md:table-cell">Unidades</TableHead> : null}
              <TableHead>Situação</TableHead>
              <TableHead className="w-14 pr-4">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              // Manager não mexe em proprietário.
              const canEdit = !isSelf && (member.role !== "owner" || currentRole === "owner");
              const otherRoles = memberRoles.filter(
                (r) => r !== member.role && (r !== "owner" || currentRole === "owner"),
              );

              return (
                <TableRow key={member.id} className={member.active ? undefined : "text-muted-foreground"}>
                  <TableCell className="pl-4">
                    <div className="font-medium">
                      {member.fullName ?? member.email ?? "Sem nome"}
                      {isSelf ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span> : null}
                    </div>
                    {member.fullName && member.email ? (
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{roleLabels[member.role]}</TableCell>
                  {showUnits ? (
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {member.role === "owner" || member.role === "manager" || member.unitIds.length === 0
                        ? "Todas"
                        : member.unitIds.map((id) => unitName.get(id) ?? "?").join(", ")}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    {!member.active ? (
                      <Badge variant="outline">Desativado</Badge>
                    ) : member.pending ? (
                      <Badge variant="secondary">Convite pendente</Badge>
                    ) : (
                      <Badge variant="outline">Ativo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={pending}
                              aria-label={`Ações para ${member.fullName ?? member.email ?? "membro"}`}
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-52">
                          {member.active ? (
                            <>
                              <DropdownMenuGroup>
                                <DropdownMenuLabel>Mudar papel para</DropdownMenuLabel>
                                {otherRoles.map((role) => (
                                  <DropdownMenuItem
                                    key={role}
                                    className="pointer-coarse:min-h-11"
                                    onClick={() => run({ memberId: member.id, role })}
                                  >
                                    {roleLabels[role]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuGroup>
                              {showUnits && (member.role === "dentist" || member.role === "receptionist") ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="pointer-coarse:min-h-11"
                                    onClick={() =>
                                      setUnitsMember({
                                        id: member.id,
                                        name: member.fullName ?? member.email ?? "membro",
                                        unitIds: member.unitIds,
                                      })
                                    }
                                  >
                                    Unidades permitidas
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                className="pointer-coarse:min-h-11"
                                onClick={() => run({ memberId: member.id, active: false })}
                              >
                                Desativar acesso
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              className="pointer-coarse:min-h-11"
                              onClick={() => run({ memberId: member.id, active: true })}
                            >
                              Reativar acesso
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <MemberUnitsDialog member={unitsMember} units={units} onClose={() => setUnitsMember(null)} />
    </div>
  );
}
