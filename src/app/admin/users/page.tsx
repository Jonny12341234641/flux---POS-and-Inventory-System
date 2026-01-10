"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Edit, Lock, Plus, Shield, Trash, User as UserIcon } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "cashier";
  created_at: string;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: User["role"] | "";
}

interface RoleConfig {
  label: string;
  className: string;
  icon: typeof Shield;
}

const DEFAULT_FORM_DATA: UserFormData = {
  name: "",
  email: "",
  password: "",
  role: "",
};

const ROLE_CONFIG: Record<User["role"], RoleConfig> = {
  admin: {
    label: "Admin",
    className: "bg-purple-100 text-purple-700",
    icon: Shield,
  },
  cashier: {
    label: "Cashier",
    className: "bg-blue-100 text-blue-700",
    icon: UserIcon,
  },
};

const formatJoinDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const extractUsers = (data: unknown): User[] => {
  let list: any[] = [];

  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const directList =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.users) && record.users);

    if (Array.isArray(directList)) {
      list = directList;
    } else if (record.data && typeof record.data === "object") {
      const nested = record.data as Record<string, unknown>;
      const nestedList =
        (Array.isArray(nested.data) && nested.data) ||
        (Array.isArray(nested.users) && nested.users);

      if (Array.isArray(nestedList)) {
        list = nestedList;
      }
    }
  }

  return list.map((user) => ({
    ...user,
    name: user.full_name || user.name || "",
  })) as User[];
};


const RoleBadge = ({ role }: { role: User["role"] }) => {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(DEFAULT_FORM_DATA);
  const [currentUserId, setCurrentUserId] = useState("");

  const fetchUsers = async (signal?: AbortSignal) => {
    setLoading(true);

    try {
      const response = await fetch("/api/users", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load users (status ${response.status}).`);
      }

      const data = await response.json();
      setUsers(extractUsers(data));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setUsers([]);
      window.alert(
        error instanceof Error ? error.message : "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.success && data.user) {
        setCurrentUserId(data.user.id);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchUsers(controller.signal);
    fetchCurrentUser(controller.signal);

    return () => controller.abort();
  }, []);

  const openCreateModal = () => {
    setCurrentUser(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setCurrentUser(user);
    setFormData({
      name: user.name ?? "",
      email: user.email ?? "",
      password: "",
      role: user.role,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentUser(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as User["role"] | "";
    setFormData((prev) => ({ ...prev, role: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedName) {
      window.alert("Name is required.");
      return;
    }

    if (!trimmedEmail) {
      window.alert("Email is required.");
      return;
    }

    if (!formData.role) {
      window.alert("Please select a role.");
      return;
    }

    const isCreate = !currentUser;

    if (isCreate && !formData.password.trim()) {
      window.alert("Password is required for new accounts.");
      return;
    }

    const endpoint = isCreate
      ? "/api/users"
      : `/api/users/${currentUser.id}`;
    const method = isCreate ? "POST" : "PUT";

    const payload = isCreate
      ? {
          name: trimmedName,
          email: trimmedEmail,
          role: formData.role,
          password: formData.password,
        }
      : {
          name: trimmedName,
          role: formData.role,
        };

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${isCreate ? "create" : "update"} user account.`
        );
      }

      await fetchUsers();
      closeModal();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to save user."
      );
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUserId) {
      window.alert("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Remove access for ${user.name}? This will delete their account.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove employee access.");
      }

      await fetchUsers();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to delete user."
      );
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team Members</h1>
          <p className="text-sm text-slate-500">
            Manage employee accounts, roles, and access.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </header>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Loading team members...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {user.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {formatJoinDate(user.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-2 text-slate-600"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(user)}
                            className="inline-flex items-center gap-2 text-red-600"
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {currentUser ? "Edit Team Member" : "Add Employee"}
                </h2>
                <p className="text-sm text-slate-500">
                  {currentUser
                    ? "Update role and profile details."
                    : "Create an account for a new employee."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="user-name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Full Name
                    </label>
                    <Input
                      id="user-name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Alex Johnson"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="user-email"
                      className="text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>
                    <Input
                      id="user-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="alex@flux.com"
                      required
                      disabled={Boolean(currentUser)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="user-role"
                      className="text-sm font-medium text-slate-700"
                    >
                      Role
                    </label>
                    <select
                      id="user-role"
                      name="role"
                      value={formData.role}
                      onChange={handleRoleChange}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      required
                    >
                      <option value="" disabled>
                        Select role
                      </option>
                      <option value="admin">Admin</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>

                  {!currentUser ? (
                    <div className="space-y-2">
                      <label
                        htmlFor="user-password"
                        className="flex items-center gap-2 text-sm font-medium text-slate-700"
                      >
                        <Lock className="h-4 w-4 text-slate-400" />
                        Temporary Password
                      </label>
                      <Input
                        id="user-password"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Set a temporary password"
                        required
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      Password changes are handled separately.
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit" className="inline-flex items-center gap-2">
                    {currentUser ? "Update Employee" : "Create Account"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
