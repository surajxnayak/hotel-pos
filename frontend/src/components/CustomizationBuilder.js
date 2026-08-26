import React, { useState } from "react";
import {
  Plus,
  Trash2,
  X,
  Sliders,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import PinModal from "./PinModal";
import {
  adminCreateCustomizationGroups,
  adminUpdateCustomizationGroup,
  adminDeleteCustomizationGroups,
  adminCreateCustomizationOptions,
  adminUpdateCustomizationOption,
  adminDeleteCustomizationOptions,
  adminMenuItems,
} from "../lib/api";

/**
 * A per-menu-item modal for building, editing, and removing customization
 * groups + options. All writes go through PinModal → admin PIN gate.
 *
 * Props:
 *   item     — full MenuItemResponse (must have .id and .customizationGroups)
 *   onClose()
 *   onDone() — called after any write so the parent can reload
 */
export default function CustomizationBuilder({ item, onClose, onDone }) {
  const [groups, setGroups] = useState(item.customizationGroups || []);
  const [pinFor, setPinFor] = useState(null); // { kind, payload, describe }
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState([]); // new groups not yet persisted
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    try {
      const items = await adminMenuItems();
      const fresh = items.find((i) => i.id === item.id);
      if (fresh) setGroups(fresh.customizationGroups || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- draft (unsaved) groups ----------
  const addDraft = () =>
    setDrafts((ds) => [
      ...ds,
      {
        _key: Math.random().toString(36).slice(2),
        name: "",
        type: "RADIO",
        required: false,
        options: [{ _key: "o0", name: "", priceDelta: "0" }],
      },
    ]);
  const removeDraft = (key) =>
    setDrafts((ds) => ds.filter((d) => d._key !== key));
  const patchDraft = (key, patch) =>
    setDrafts((ds) => ds.map((d) => (d._key === key ? { ...d, ...patch } : d)));
  const patchDraftOption = (key, oKey, patch) =>
    setDrafts((ds) =>
      ds.map((d) =>
        d._key === key
          ? {
              ...d,
              options: d.options.map((o) =>
                o._key === oKey ? { ...o, ...patch } : o
              ),
            }
          : d
      )
    );
  const addDraftOption = (key) =>
    patchDraft(key, {
      options: [
        ...drafts.find((d) => d._key === key).options,
        { _key: Math.random().toString(36).slice(2), name: "", priceDelta: "0" },
      ],
    });
  const removeDraftOption = (key, oKey) =>
    patchDraft(key, {
      options: drafts
        .find((d) => d._key === key)
        .options.filter((o) => o._key !== oKey),
    });

  const validateDrafts = () => {
    for (const d of drafts) {
      if (!d.name.trim()) return "Every group needs a name.";
      if (!d.options.length) return `Group "${d.name}" needs at least one option.`;
      for (const o of d.options) {
        if (!o.name.trim()) return `Every option in "${d.name}" needs a name.`;
        if (!Number.isFinite(Number(o.priceDelta)))
          return `Price delta for "${o.name}" must be a number.`;
      }
    }
    return null;
  };

  const saveDrafts = () => {
    const err = validateDrafts();
    if (err) return toast.error(err);
    setPinFor({
      kind: "create-groups",
      describe: `Add ${drafts.length} group(s) to "${item.name}".`,
      payload: drafts.map((d) => ({
        name: d.name.trim(),
        type: d.type,
        required: !!d.required,
        options: d.options.map((o) => ({
          name: o.name.trim(),
          priceDelta: Number(o.priceDelta),
        })),
      })),
    });
  };

  // ---------- existing group ops ----------
  const patchExisting = (groupId, patch) =>
    setPinFor({
      kind: "update-group",
      groupId,
      payload: patch,
      describe: `Update group.`,
    });
  const deleteExisting = (groupId, groupName) => {
    if (!window.confirm(`Delete group "${groupName}" and all its options?`)) return;
    setPinFor({
      kind: "delete-groups",
      payload: [groupId],
      describe: `Delete group "${groupName}".`,
    });
  };
  const addOption = (groupId, opts) =>
    setPinFor({
      kind: "add-options",
      groupId,
      payload: opts,
      describe: `Add ${opts.length} option(s).`,
    });
  const patchOption = (optionId, patch) =>
    setPinFor({
      kind: "update-option",
      optionId,
      payload: patch,
      describe: `Update option.`,
    });
  const deleteOption = (optionId, optionName) => {
    if (!window.confirm(`Delete option "${optionName}"?`)) return;
    setPinFor({
      kind: "delete-options",
      payload: [optionId],
      describe: `Delete option "${optionName}".`,
    });
  };

  // ---------- PIN handler ----------
  const runPinned = async (pin) => {
    setSaving(true);
    try {
      const { kind, groupId, optionId, payload } = pinFor;
      if (kind === "create-groups") {
        await adminCreateCustomizationGroups(item.id, pin, payload);
        toast.success("Groups added");
        setDrafts([]);
      } else if (kind === "update-group") {
        await adminUpdateCustomizationGroup(groupId, { pin, ...payload });
        toast.success("Group updated");
      } else if (kind === "delete-groups") {
        await adminDeleteCustomizationGroups(pin, payload);
        toast.success("Group deleted");
      } else if (kind === "add-options") {
        await adminCreateCustomizationOptions(groupId, pin, payload);
        toast.success("Options added");
      } else if (kind === "update-option") {
        await adminUpdateCustomizationOption(optionId, { pin, ...payload });
        toast.success("Option updated");
      } else if (kind === "delete-options") {
        await adminDeleteCustomizationOptions(pin, payload);
        toast.success("Option deleted");
      }
      setPinFor(null);
      await reload();
      onDone?.();
    } catch (e) {
      toast.error(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm grid place-items-center p-4"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="customization-builder"
          className="bg-surface rounded-3xl max-w-2xl w-full shadow-lift max-h-[90vh] flex flex-col animate-fadeUp"
        >
          <div className="px-6 py-4 border-b border-bg2 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-brand/10 text-brand grid place-items-center">
              <Sliders size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-ink2 font-semibold">
                Customization for
              </div>
              <div className="font-heading text-lg font-semibold truncate">
                {item.name}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-ink2 hover:text-ink p-1 rounded-full hover:bg-bg2"
              data-testid="cb-close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {busy && (
              <div className="text-center text-ink2 text-xs">
                <Loader2 size={14} className="animate-spin inline mr-1" />
                Refreshing…
              </div>
            )}

            {/* Existing groups */}
            {groups.length === 0 && drafts.length === 0 && (
              <div className="text-center py-8 border border-dashed border-bg2 rounded-2xl text-sm text-ink2">
                No customization yet. Add a group below (e.g. "Portion Size", "Add-ons").
              </div>
            )}
            {groups.map((g) => (
              <ExistingGroup
                key={g.id}
                group={g}
                onPatchGroup={(patch) => patchExisting(g.id, patch)}
                onDeleteGroup={() => deleteExisting(g.id, g.name)}
                onAddOptions={(opts) => addOption(g.id, opts)}
                onPatchOption={(oid, patch) => patchOption(oid, patch)}
                onDeleteOption={(oid, name) => deleteOption(oid, name)}
              />
            ))}

            {/* Drafts (unsaved) */}
            {drafts.map((d) => (
              <DraftGroup
                key={d._key}
                draft={d}
                onPatch={(patch) => patchDraft(d._key, patch)}
                onPatchOption={(oKey, patch) => patchDraftOption(d._key, oKey, patch)}
                onAddOption={() => addDraftOption(d._key)}
                onRemoveOption={(oKey) => removeDraftOption(d._key, oKey)}
                onRemove={() => removeDraft(d._key)}
              />
            ))}
          </div>

          <div className="px-6 py-4 border-t border-bg2 flex items-center gap-2 flex-wrap">
            <button
              onClick={addDraft}
              data-testid="cb-add-group"
              className="flex items-center gap-1.5 rounded-full border border-bg2 hover:border-brand hover:text-brand text-sm px-4 py-2 transition"
            >
              <Plus size={12} />
              Add group
            </button>
            <div className="flex-1" />
            {drafts.length > 0 && (
              <button
                onClick={saveDrafts}
                disabled={saving}
                data-testid="cb-save-drafts"
                className="flex items-center gap-1.5 rounded-full bg-brand hover:bg-brandHover text-white text-sm px-4 py-2 shadow-lift disabled:opacity-50 transition"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ShieldCheck size={12} />
                )}
                Save {drafts.length} draft{drafts.length > 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-sm text-ink2 hover:text-ink px-3 py-2"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {pinFor && (
        <PinModal
          title="Confirm customization change"
          description={pinFor.describe}
          onClose={() => setPinFor(null)}
          onSubmit={runPinned}
        />
      )}
    </>
  );
}

// -------------------- existing group (already persisted) --------------------
function ExistingGroup({
  group,
  onPatchGroup,
  onDeleteGroup,
  onAddOptions,
  onPatchOption,
  onDeleteOption,
}) {
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(group.name);
  const [required, setRequired] = useState(group.required);
  const [type, setType] = useState(group.type);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionDelta, setNewOptionDelta] = useState("0");

  const commitHeader = () => {
    const patch = {};
    if (name.trim() && name !== group.name) patch.name = name.trim();
    if (required !== group.required) patch.required = required;
    if (type !== group.type) patch.type = type;
    if (Object.keys(patch).length) onPatchGroup(patch);
    setEditName(false);
  };

  const submitNewOption = () => {
    if (!newOptionName.trim()) return;
    onAddOptions([
      { name: newOptionName.trim(), priceDelta: Number(newOptionDelta) || 0 },
    ]);
    setNewOptionName("");
    setNewOptionDelta("0");
  };

  return (
    <div
      data-testid={`cb-group-${group.id}`}
      className="rounded-2xl border border-bg2 bg-bg/40"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bg2">
        {editName ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-surface border border-bg2 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        ) : (
          <div className="flex-1 font-heading font-semibold">{group.name}</div>
        )}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-surface border border-bg2 rounded-lg text-xs px-2 py-1 outline-none"
        >
          <option value="RADIO">Radio (single)</option>
          <option value="CHECKBOX">Checkbox (multi)</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-ink2">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Required
        </label>
        {(editName || required !== group.required || type !== group.type) && (
          <button
            onClick={commitHeader}
            className="text-xs rounded-full bg-brand text-white px-3 py-1"
            data-testid={`cb-group-save-${group.id}`}
          >
            Save
          </button>
        )}
        {!editName && (
          <button
            onClick={() => setEditName(true)}
            className="text-ink2 hover:text-brand p-1"
          >
            <Pencil size={12} />
          </button>
        )}
        <button
          onClick={onDeleteGroup}
          className="text-ink2 hover:text-destructive p-1"
          data-testid={`cb-group-delete-${group.id}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="divide-y divide-bg2">
        {(group.options || []).map((o) => (
          <OptionRow
            key={o.id}
            option={o}
            onPatch={(patch) => onPatchOption(o.id, patch)}
            onDelete={() => onDeleteOption(o.id, o.name)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 px-4 py-2 border-t border-bg2">
        <input
          value={newOptionName}
          onChange={(e) => setNewOptionName(e.target.value)}
          placeholder="New option name…"
          className="flex-1 bg-surface border border-bg2 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <div className="flex items-center gap-1 bg-surface border border-bg2 rounded-lg px-2 py-1">
          <span className="text-xs text-ink2">₹</span>
          <input
            type="number"
            inputMode="decimal"
            value={newOptionDelta}
            onChange={(e) => setNewOptionDelta(e.target.value)}
            className="w-16 bg-transparent text-sm outline-none tabular-nums"
          />
        </div>
        <button
          onClick={submitNewOption}
          disabled={!newOptionName.trim()}
          className="text-xs flex items-center gap-1 rounded-full bg-ink hover:bg-black text-white px-3 py-1 disabled:opacity-40"
          data-testid={`cb-add-option-${group.id}`}
        >
          <Plus size={11} />
          Add
        </button>
      </div>
    </div>
  );
}

function OptionRow({ option, onPatch, onDelete }) {
  const [name, setName] = useState(option.name);
  const [delta, setDelta] = useState(String(option.priceDelta ?? 0));
  const dirty =
    name.trim() !== option.name ||
    Number(delta) !== Number(option.priceDelta || 0);
  const submit = () => {
    const patch = {};
    if (name.trim() !== option.name) patch.name = name.trim();
    const dNum = Number(delta);
    if (Number.isFinite(dNum) && dNum !== Number(option.priceDelta || 0)) {
      patch.priceDelta = dNum;
    }
    if (Object.keys(patch).length) onPatch(patch);
  };
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 bg-transparent text-sm outline-none"
      />
      <div className="flex items-center gap-1 text-xs text-ink2">
        <span>₹</span>
        <input
          type="number"
          inputMode="decimal"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className="w-16 bg-bg border border-bg2 rounded-lg px-1 py-0.5 outline-none tabular-nums"
        />
      </div>
      {dirty && (
        <button
          onClick={submit}
          className="text-xs rounded-full bg-brand text-white px-3 py-0.5"
        >
          Save
        </button>
      )}
      <button
        onClick={onDelete}
        className="text-ink2 hover:text-destructive p-1"
        data-testid={`cb-option-delete-${option.id}`}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// -------------------- draft group (unsaved) --------------------
function DraftGroup({
  draft,
  onPatch,
  onPatchOption,
  onAddOption,
  onRemoveOption,
  onRemove,
}) {
  return (
    <div className="rounded-2xl border border-dashed border-brand/40 bg-brand/5">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-brand/20">
        <input
          autoFocus
          value={draft.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Group name (e.g. Portion Size)"
          className="flex-1 bg-surface border border-bg2 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        <select
          value={draft.type}
          onChange={(e) => onPatch({ type: e.target.value })}
          className="bg-surface border border-bg2 rounded-lg text-xs px-2 py-1 outline-none"
        >
          <option value="RADIO">Radio (single)</option>
          <option value="CHECKBOX">Checkbox (multi)</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-ink2">
          <input
            type="checkbox"
            checked={!!draft.required}
            onChange={(e) => onPatch({ required: e.target.checked })}
          />
          Required
        </label>
        <button
          onClick={onRemove}
          className="text-ink2 hover:text-destructive p-1"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="divide-y divide-brand/10">
        {draft.options.map((o) => (
          <div key={o._key} className="flex items-center gap-2 px-4 py-2">
            <input
              value={o.name}
              onChange={(e) => onPatchOption(o._key, { name: e.target.value })}
              placeholder="Option name"
              className="flex-1 bg-surface border border-bg2 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="flex items-center gap-1 bg-surface border border-bg2 rounded-lg px-2 py-1">
              <span className="text-xs text-ink2">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={o.priceDelta}
                onChange={(e) =>
                  onPatchOption(o._key, { priceDelta: e.target.value })
                }
                className="w-16 bg-transparent text-sm outline-none tabular-nums"
              />
            </div>
            {draft.options.length > 1 && (
              <button
                onClick={() => onRemoveOption(o._key)}
                className="text-ink2 hover:text-destructive p-1"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-brand/20">
        <button
          onClick={onAddOption}
          className="text-xs flex items-center gap-1 text-brand hover:underline"
        >
          <Plus size={11} />
          Add option
        </button>
      </div>
      <div className="flex items-start gap-2 px-4 py-2 border-t border-brand/20 text-[11px] text-ink2">
        <AlertTriangle size={11} className="text-brand mt-0.5" />
        Draft — save with your admin PIN when ready.
      </div>
    </div>
  );
}
