"use client";

import { useState, type FormEvent } from "react";
import { services as initialServices } from "@/app/data/services";
import type { Service } from "@/app/types/domain";
import { createSlug, formatCurrency } from "@/app/utils/format";
import { usePersistentState } from "@/app/hooks/usePersistentState";
import {
  Badge,
  Button,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";

export function ServicesManagement({
  onToast,
}: {
  onToast: (message: string) => void;
}) {
  const [items, setItems] = usePersistentState<Service[]>(
    "barracks-services-v2",
    initialServices,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [newService, setNewService] = useState({
    name: "",
    description: "",
    duration: "",
    price: "",
  });

  function addService(event: FormEvent) {
    event.preventDefault();
    if (!newService.name.trim()) {
      onToast("Add a service name first");
      return;
    }

    const created: Service = {
      id: createSlug(newService.name),
      name: newService.name,
      description: newService.description,
      duration: newService.duration,
      price: Number(newService.price),
      active: true,
    };

    setItems((list) => [...list, created]);
    setNewService({
      name: "",
      description: "",
      duration: "",
      price: "",
    });
    setModalOpen(false);
    onToast(created.name + " added to services");
  }

  function saveService(event: FormEvent) {
    event.preventDefault();
    if (!editing?.name.trim() || !editing?.description.trim()) {
      onToast("Service name and description are required");
      return;
    }
    const price = Number(editing.price);
    if (!Number.isFinite(price) || price < 0) {
      onToast("Enter a valid service price");
      return;
    }

    setItems((list) =>
      list.map((item) =>
        item.id === editing.id
          ? { ...editing, name: editing.name.trim(), price }
          : item,
      ),
    );
    onToast(editing.name + " updated");
    setEditing(null);
  }

  const visibleItems = items.filter(
    (service) =>
      filter === "All" ||
      (filter === "Active" ? service.active : !service.active),
  );

  return (
    <>
      <PageHeader
        title="Services"
        action={
          <Button icon="plus" onClick={() => setModalOpen(true)}>
            Add service
          </Button>
        }
      />
      <div className="metrics-grid metrics-grid--three">
        <MetricCard
          label="Total services"
          value={String(items.length)}
          icon="briefcase"
          accent="blue"
        />
        <MetricCard
          label="Average price"
          value={formatCurrency(items.length ? items.reduce((total, item) => total + item.price, 0) / items.length : 0)}
          icon="wallet"
          accent="green"
        />
        <MetricCard
          label="Most popular"
          value="—"
          icon="star"
          accent="amber"
        />
      </div>

      <Panel className="services-panel">
        <SectionHeading
          title="All services"
          action={
            <Button
              variant="ghost"
              size="sm"
              icon="filter"
              onClick={() => setFilterOpen(true)}
            >
              Filters
            </Button>
          }
        />
        <div className="services-table">
          <div className="services-table__head">
            <span>Service</span>
            <span>Description</span>
            <span>Duration</span>
            <span>Price</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {visibleItems.length ? visibleItems.map((service) => (
            <div className="services-table__row" key={service.id}>
              <span>
                <strong>{service.name}</strong>
              </span>
              <span>{service.description}</span>
              <span>{service.duration}</span>
              <strong>{formatCurrency(service.price)}</strong>
              <span>
                <Badge tone={service.active ? "success" : "warning"}>
                  {service.active ? "Active" : "Inactive"}
                </Badge>
              </span>
              <span className="row-actions">
                <button
                  className="row-action"
                  type="button"
                  onClick={() => setEditing({ ...service })}
                >
                  Edit
                </button>
                <button
                  className={
                    "row-action " +
                    (service.active
                      ? "row-action--danger"
                      : "row-action--green")
                  }
                  type="button"
                  onClick={() => {
                    setItems((list) =>
                      list.map((row) =>
                        row.id === service.id
                          ? { ...row, active: !row.active }
                          : row,
                      ),
                    );
                    onToast(
                      service.name +
                        (service.active ? " disabled" : " enabled"),
                    );
                  }}
                >
                  {service.active ? "Disable" : "Enable"}
                </button>
              </span>
            </div>
          )) : (
            <EmptyState
              title={items.length ? "No services match this filter" : "No services yet"}
              description={items.length ? "Try another filter to see more of the catalog." : "Service options will appear when they are added to the catalog."}
            />
          )}
        </div>
      </Panel>

      <Modal
        open={modalOpen}
        title="Add service"
        description="Add a new option to the Barracks menu."
        onClose={() => setModalOpen(false)}
      >
        <form className="modal-form" onSubmit={addService}>
          <TextField
            label="Service name"
            value={newService.name}
            onChange={(event) =>
              setNewService({ ...newService, name: event.target.value })
            }
            placeholder="e.g. Executive Shave"
          />
          <TextField
            label="Description"
            value={newService.description}
            onChange={(event) =>
              setNewService({ ...newService, description: event.target.value })
            }
            placeholder="Short description for the service menu"
          />
          <div className="form-grid form-grid--two">
            <TextField
              label="Duration"
              value={newService.duration}
              onChange={(event) =>
                setNewService({ ...newService, duration: event.target.value })
              }
            />
            <TextField
              label="Price"
              type="number"
              value={newService.price}
              onChange={(event) =>
                setNewService({ ...newService, price: event.target.value })
              }
            />
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" icon="plus">
              Add service
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit service"
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form className="modal-form" onSubmit={saveService}>
            <TextField
              label="Service name"
              value={editing.name}
              onChange={(event) =>
                setEditing({ ...editing, name: event.target.value })
              }
            />
            <TextField
              label="Description"
              value={editing.description}
              onChange={(event) =>
                setEditing({ ...editing, description: event.target.value })
              }
            />
            <div className="form-grid form-grid--two">
              <TextField
                label="Duration"
                value={editing.duration}
                onChange={(event) =>
                  setEditing({ ...editing, duration: event.target.value })
                }
              />
              <TextField
                label="Price"
                type="number"
                min="0"
                step="0.01"
                value={String(editing.price)}
                onChange={(event) =>
                  setEditing({ ...editing, price: Number(event.target.value) })
                }
              />
            </div>
            <SelectField
              label="Status"
              value={editing.active ? "Active" : "Inactive"}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  active: event.target.value === "Active",
                })
              }
            >
              <option>Active</option>
              <option>Inactive</option>
            </SelectField>
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" icon="check">
                Save changes
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={filterOpen}
        title="Filter services"
        onClose={() => setFilterOpen(false)}
      >
        <div className="modal-form">
          <SelectField
            label="Show"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option>All</option>
            <option>Active</option>
            <option>Inactive</option>
          </SelectField>
          <div className="modal-actions">
            <Button type="button" onClick={() => setFilterOpen(false)}>
              Apply filter
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
