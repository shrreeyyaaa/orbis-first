"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNewParam } from "@/lib/use-new-param";
import { toast } from "@/components/ui/use-toast";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, EnumSelect } from "@/components/form-fields";
import { OWNER_KIND_LABELS } from "@/lib/labels";
import type { Owner, OwnerKind } from "@/lib/types";
import { Users, Plus, Pencil, Building2, User, Landmark } from "lucide-react";

const LEGAL_KINDS: OwnerKind[] = ["trust", "llc", "corporation", "foundation", "estate"];

function kindIcon(kind: OwnerKind) {
  if (kind === "individual" || kind === "joint") return User;
  if (kind === "trust" || kind === "estate") return Landmark;
  return Building2;
}

export function FamilyView({
  householdId,
  owners,
}: {
  householdId: string;
  owners: Owner[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  useNewParam(() => {
    setEditing(null);
    setOpen(true);
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(o: Owner) {
    setEditing(o);
    setOpen(true);
  }

  const people = owners.filter((o) => o.kind === "individual" || o.kind === "joint");
  const entities = owners.filter((o) => LEGAL_KINDS.includes(o.kind));

  return (
    <div>
      <PageHeader
        title="Family & Entities"
        description="People, trusts, LLCs, and other legal entities that own your wealth."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Add owner
          </Button>
        }
      />

      {owners.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No owners yet"
          description="Add family members and legal entities like trusts and LLCs to assign ownership of accounts and assets."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Add your first owner
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Section title="Family members" items={people} onEdit={openEdit} />
          <Section title="Trusts, LLCs & legal entities" items={entities} onEdit={openEdit} />
        </div>
      )}

      <OwnerDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        householdId={householdId}
        owner={editing}
        onSaved={() => {
          setOpen(false);
          toast({ title: editing ? "Owner updated" : "Owner added", variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function Section({
  title,
  items,
  onEdit,
}: {
  title: string;
  items: Owner[];
  onEdit: (o: Owner) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((o) => {
          const Icon = kindIcon(o.kind);
          return (
            <Card key={o.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className="mt-0.5 rounded-lg p-2"
                  style={{ background: (o.color ?? "#2563eb") + "20", color: o.color ?? "#2563eb" }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{o.name}</p>
                    {o.is_default && <Badge variant="secondary">You</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {OWNER_KIND_LABELS[o.kind]}
                    {o.relationship ? ` · ${o.relationship}` : ""}
                  </p>
                  {o.trust_type && (
                    <p className="mt-1 text-xs text-muted-foreground">{o.trust_type}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => onEdit(o)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OwnerDialog({
  open,
  onOpenChange,
  householdId,
  owner,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  householdId: string;
  owner: Owner | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(owner?.name ?? "");
  const [kind, setKind] = useState<OwnerKind>(owner?.kind ?? "individual");
  const [relationship, setRelationship] = useState(owner?.relationship ?? "");
  const [legalName, setLegalName] = useState(owner?.legal_name ?? "");
  const [trustType, setTrustType] = useState(owner?.trust_type ?? "");
  const [grantor, setGrantor] = useState(owner?.grantor ?? "");
  const [beneficiaries, setBeneficiaries] = useState(owner?.beneficiaries ?? "");
  const [dob, setDob] = useState(owner?.date_of_birth ?? "");
  const [notes, setNotes] = useState(owner?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLegal = LEGAL_KINDS.includes(kind);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const payload = {
      household_id: householdId,
      name,
      kind,
      relationship: relationship || null,
      legal_name: legalName || null,
      trust_type: isLegal ? trustType || null : null,
      grantor: isLegal ? grantor || null : null,
      beneficiaries: isLegal ? beneficiaries || null : null,
      date_of_birth: dob || null,
      notes: notes || null,
    };
    const { error } = owner
      ? await supabase.from("owners").update(payload).eq("id", owner.id)
      : await supabase.from("owners").insert(payload);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{owner ? "Edit owner" : "Add owner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith or Smith Family Trust" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <EnumSelect value={kind} onChange={setKind} options={OWNER_KIND_LABELS} />
            </Field>
            <Field label={isLegal ? "Contact / role" : "Relationship"}>
              <Input
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder={isLegal ? "Trustee" : "Spouse, Son…"}
              />
            </Field>
          </div>
          {isLegal ? (
            <>
              <Field label="Legal name">
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sub-type">
                  <Input
                    value={trustType}
                    onChange={(e) => setTrustType(e.target.value)}
                    placeholder="Revocable / Irrevocable"
                  />
                </Field>
                <Field label="Grantor / Manager">
                  <Input value={grantor} onChange={(e) => setGrantor(e.target.value)} />
                </Field>
              </div>
              <Field label="Beneficiaries">
                <Textarea
                  value={beneficiaries}
                  onChange={(e) => setBeneficiaries(e.target.value)}
                  placeholder="Who benefits from this entity"
                />
              </Field>
            </>
          ) : (
            <Field label="Date of birth">
              <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
          )}
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !name}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
