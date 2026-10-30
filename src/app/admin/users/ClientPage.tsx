
"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "product_manager" | "order_manager" | "stock_category_manager" | "custom";
type Permission =
  | "products.read" | "products.create" | "products.update" | "products.delete"
  | "orders.read" | "orders.update"
  | "stock.read" | "stock.update"
  | "categories.read" | "categories.update"
  | "cloudinary.upload" | "banners.manage";

type AdminUser = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  permissions: Permission[];
};

const PERMISSIONS: { id: Permission; label: string }[] = [
  { id: "products.read", label: "পণ্য দেখা" },
  { id: "products.create", label: "পণ্য তৈরি" },
  { id: "products.update", label: "পণ্য সম্পাদনা" },
  { id: "products.delete", label: "পণ্য মুছে ফেলা" },
  { id: "orders.read", label: "অর্ডার দেখা" },
  { id: "orders.update", label: "অর্ডার আপডেট" },
  { id: "stock.read", label: "স্টক দেখা" },
  { id: "stock.update", label: "স্টক পরিবর্তন" },
  { id: "categories.read", label: "ক্যাটাগরি দেখা" },
  { id: "categories.update", label: "ক্যাটাগরি পরিচালনা" },
  { id: "cloudinary.upload", label: "পণ্যের ছবি আপলোড" },
  { id: "banners.manage", label: "ব্যানার পরিচালনা" },
];

const ROLE_LABELS: Record<Role, string> = {
  product_manager: "পণ্য ম্যানেজার",
  order_manager: "অর্ডার ম্যানেজার",
  stock_category_manager: "স্টক ও ক্যাটাগরি ম্যানেজার",
  custom: "নিজস্ব অনুমতি",
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  product_manager: [
    "products.read", "products.create", "products.update",
    "products.delete", "cloudinary.upload",
  ],
  order_manager: ["orders.read", "orders.update"],
  stock_category_manager: [
    "stock.read", "stock.update", "categories.read", "categories.update",
  ],
  custom: [],
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("product_manager");
  const [permissions, setPermissions] = useState<Permission[]>(
    ROLE_PERMISSIONS.product_manager,
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "অ্যাডমিন তালিকা লোড করা যায়নি।");
      }

      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "তথ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadUsers());
  }, [loadUsers]);

  function changeRole(nextRole: Role) {
    setRole(nextRole);
    setPermissions([...ROLE_PERMISSIONS[nextRole]]);
  }

  function togglePermission(permission: Permission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  async function createAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          permissions,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "সাব-অ্যাডমিন তৈরি করা যায়নি।");
      }

      setMessage("সাব-অ্যাডমিন সফলভাবে তৈরি হয়েছে।");
      setName("");
      setEmail("");
      setPassword("");
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অপারেশন ব্যর্থ হয়েছে।");
    } finally {
      setSaving(false);
    }
  }

  async function updateAdmin(
    user: AdminUser,
    changes: { active?: boolean; role?: Role; permissions?: Permission[] },
  ) {
    const action = changes.active === undefined
      ? "অনুমতি পরিবর্তন"
      : changes.active
        ? "অ্যাকাউন্ট সক্রিয়"
        : "অ্যাকাউন্ট নিষ্ক্রিয়";

    if (!window.confirm(`আপনি কি ${user.name}-এর ${action} করতে চান?`)) {
      return;
    }

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, ...changes }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "পরিবর্তন করা যায়নি।");
      }

      setMessage(data.message || "পরিবর্তন সফল হয়েছে।");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "পরিবর্তন ব্যর্থ হয়েছে।");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-green-800">
            অ্যাডমিন ও অনুমতি
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            সাব-অ্যাডমিন তৈরি করুন এবং তাদের কাজের অনুমতি পরিচালনা করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-lg bg-green-700 px-4 py-3 font-semibold text-white"
        >
          {showForm ? "ফর্ম বন্ধ করুন" : "+ নতুন অ্যাডমিন"}
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {message}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={createAdmin}
          className="space-y-5 rounded-xl border bg-white p-4 shadow-sm sm:p-6"
        >
          <h2 className="text-lg font-bold">নতুন সাব-অ্যাডমিন তৈরি</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              নাম
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="অ্যাডমিনের নাম"
              />
            </label>

            <label className="space-y-1 text-sm font-medium">
              ইমেইল
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="admin@example.com"
              />
            </label>

            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              অস্থায়ী পাসওয়ার্ড
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border p-3"
                placeholder="কমপক্ষে ৮ অক্ষর"
              />
              <span className="block text-xs text-gray-500">
                পাসওয়ার্ডটি নিরাপদে অ্যাডমিনকে দিন। তৈরি হওয়ার পর এখানে দেখানো হবে না।
              </span>
            </label>
          </div>

          <label className="block space-y-1 text-sm font-medium">
            রোল নির্বাচন
            <select
              value={role}
              onChange={(e) => changeRole(e.target.value as Role)}
              className="w-full rounded-lg border bg-white p-3"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <h3 className="mb-3 font-semibold">কাজের অনুমতি</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {PERMISSIONS.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="h-4 w-4 accent-green-700"
                  />
                  {permission.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              রোল বদলালে সেই রোলের ডিফল্ট অনুমতিগুলো নির্বাচন হবে। চাইলে পরে পরিবর্তন করতে পারবেন।
            </p>
          </div>

          <button
            disabled={saving}
            className="w-full rounded-lg bg-green-700 p-3 font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {saving ? "তৈরি হচ্ছে..." : "সাব-অ্যাডমিন তৈরি করুন"}
          </button>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">সাব-অ্যাডমিন তালিকা</h2>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading || saving}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          >
            রিফ্রেশ
          </button>
        </div>

        {loading ? (
          <p className="rounded-xl border p-5 text-gray-600">
            অ্যাডমিন তালিকা লোড হচ্ছে...
          </p>
        ) : users.length === 0 ? (
          <p className="rounded-xl border p-5 text-gray-600">
            কোনো সাব-অ্যাডমিন পাওয়া যায়নি।
          </p>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <article
                key={user.uid}
                className="space-y-4 rounded-xl border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-bold">{user.name}</h3>
                    <p className="break-all text-sm text-gray-600">
                      {user.email}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {user.uid}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      user.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">রোল</span>
                    <select
                      value={user.role}
                      disabled={saving}
                      onChange={(e) => {
                        const nextRole = e.target.value as Role;
                        void updateAdmin(user, {
                          role: nextRole,
                          permissions: ROLE_PERMISSIONS[nextRole],
                        });
                      }}
                      className="w-full rounded-lg border bg-white p-2"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-1 text-sm">
                    <span className="font-medium">অনুমতি</span>
                    <p className="text-gray-600">
                      {user.permissions.length}টি অনুমতি
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setError("");
                        setMessage("");
                        const selected = new Set(user.permissions);

                        const nextPermissions = PERMISSIONS.filter((item) =>
                          selected.has(item.id),
                        );

                        const answer = window.prompt(
                          "অনুমতি নম্বর দিয়ে নির্বাচন করুন। যেমন: 1,2,5,11\n\n" +
                            PERMISSIONS.map(
                              (item, index) =>
                                `${index + 1}. ${item.label} (${item.id})`,
                            ).join("\n"),
                          nextPermissions
                            .map((item) => PERMISSIONS.findIndex(
                              (permission) => permission.id === item.id,
                            ) + 1)
                            .join(","),
                        );

                        if (answer === null) return;

                        const numbers = answer.trim()
                          ? answer.split(",").map((item) => Number(item.trim()))
                          : [];

                        if (
                          numbers.some(
                            (number) =>
                              !Number.isInteger(number) ||
                              number < 1 ||
                              number > PERMISSIONS.length,
                          ) ||
                          new Set(numbers).size !== numbers.length
                        ) {
                          setError("অনুমতি নম্বর সঠিক নয়। আবার চেষ্টা করুন।");
                          return;
                        }

                        void updateAdmin(user, {
                          permissions: numbers.map(
                            (number) => PERMISSIONS[number - 1].id,
                          ),
                        });
                      }}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      অনুমতি সম্পাদনা
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void updateAdmin(user, { active: !user.active })
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                      user.active ? "bg-red-600" : "bg-green-700"
                    }`}
                  >
                    {user.active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
