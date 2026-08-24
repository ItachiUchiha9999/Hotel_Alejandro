"use client";

import { useEffect, useMemo, useState } from "react";

type Stock = {
  stock_id: number;
  article_id: number;
  deposit_id: number;
  stock_amount: number | string;

  articles: {
    article_id: number;
    article_code: string;
    article_name: string;
  };

  deposit: {
    deposit_id: number;
    deposit_name: string;
  };
};

type Employee = {
  employees_id: number;
  employees_name: string;
  employees_lastname: string;
};

type Deposit = {
  deposit_id: number;
  deposit_name: string;
};

type MovementType = {
  movement_type_id: number;
  movement_type: string;
  description: string;
  effect: "SUMA" | "RESTA" | "TRANSFERENCIA";
  active: boolean;
};

type Detail = {
  articleId: number;
  articleName: string;
  articleCode: string;
  stockId: number;
  stockAvailable: number;
  amount: number;
};

type Toast = {
  message: string;
  type: "success" | "error";
} | null;

export default function StockMovementsPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);

  const [type, setType] = useState("");
  const [depositId, setDepositId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [observations, setObservations] = useState("");

  const [articleId, setArticleId] = useState("");
  const [amount, setAmount] = useState("");

  const [details, setDetails] = useState<Detail[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [toast]);

  async function loadData() {
    try {
      setLoading(true);

      const [
        stocksResponse,
        employeesResponse,
        depositsResponse,
        movementTypesResponse,
      ] = await Promise.all([
        fetch("http://localhost:3001/api/catalog/stocks"),
        fetch("http://localhost:3001/api/catalog/employees"),
        fetch("http://localhost:3001/api/catalog/deposits"),
        fetch("http://localhost:3001/api/movement-types"),
      ]);

      if (
        !stocksResponse.ok ||
        !employeesResponse.ok ||
        !depositsResponse.ok ||
        !movementTypesResponse.ok
      ) {
        throw new Error("No se pudieron cargar los datos.");
      }

      const stocksData = await stocksResponse.json();
      const employeesData = await employeesResponse.json();
      const depositsData = await depositsResponse.json();
      const movementTypesData = await movementTypesResponse.json();

      setStocks(stocksData);
      setEmployees(employeesData);
      setDeposits(depositsData);

      // STK-05 no muestra transferencias porque corresponden a STK-06
      setMovementTypes(
        movementTypesData.filter(
          (movementType: MovementType) =>
            movementType.active &&
            movementType.effect !== "TRANSFERENCIA"
        )
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Error al cargar los datos.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedMovementType = useMemo(() => {
    return movementTypes.find(
      (movementType) => movementType.movement_type === type
    );
  }, [movementTypes, type]);

  const selectedEffect = selectedMovementType?.effect;

  const availableStocks = useMemo(() => {
    if (!depositId) return [];

    return stocks.filter(
      (stock) => String(stock.deposit_id) === String(depositId)
    );
  }, [stocks, depositId]);

  const selectedStock = useMemo(() => {
    return availableStocks.find(
      (stock) => String(stock.article_id) === String(articleId)
    );
  }, [availableStocks, articleId]);

  const numericAmount = Number(amount);

  const validAmount =
    amount !== "" &&
    Number.isInteger(numericAmount) &&
    numericAmount > 0;

  const exceedsStock =
    selectedEffect === "RESTA" &&
    !!selectedStock &&
    validAmount &&
    numericAmount > Number(selectedStock.stock_amount);

  const canAddArticle =
    !!selectedStock && validAmount && !exceedsStock;

  function showToast(message: string, type: "success" | "error") {
    setToast({
      message,
      type,
    });
  }

  function clearArticleFields() {
    setArticleId("");
    setAmount("");
  }

  function clearForm() {
    setType("");
    setDepositId("");
    setEmployeeId("");
    setObservations("");
    setArticleId("");
    setAmount("");
    setDetails([]);
  }

  function handleTypeChange(movementType: MovementType) {
    setType(movementType.movement_type);

    setArticleId("");
    setAmount("");
    setDetails([]);
  }

  function handleDepositChange(value: string) {
    setDepositId(value);

    setArticleId("");
    setAmount("");
    setDetails([]);
  }

  function handleAmountChange(value: string) {
    if (value === "") {
      setAmount("");
      return;
    }

    // Solamente enteros positivos
    if (!/^\d+$/.test(value)) {
      return;
    }

    setAmount(value);
  }

  function handleAddArticle() {
    if (!selectedStock) {
      showToast("Debe seleccionar un artículo.", "error");
      return;
    }

    const quantity = Number(amount);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      showToast(
        "La cantidad debe ser un número entero mayor a 0.",
        "error"
      );
      return;
    }

    if (
      selectedEffect === "RESTA" &&
      quantity > Number(selectedStock.stock_amount)
    ) {
      showToast(
        "La cantidad supera el stock disponible.",
        "error"
      );
      return;
    }

    const alreadyAdded = details.some(
      (detail) => detail.articleId === selectedStock.article_id
    );

    if (alreadyAdded) {
      showToast(
        "Ese artículo ya fue agregado al movimiento.",
        "error"
      );
      return;
    }

    const newDetail: Detail = {
      articleId: selectedStock.article_id,
      articleName: selectedStock.articles.article_name,
      articleCode: selectedStock.articles.article_code,
      stockId: selectedStock.stock_id,
      stockAvailable: Number(selectedStock.stock_amount),
      amount: quantity,
    };

    setDetails((currentDetails) => [
      ...currentDetails,
      newDetail,
    ]);

    clearArticleFields();
  }

  function removeDetail(articleIdToRemove: number) {
    setDetails((currentDetails) =>
      currentDetails.filter(
        (detail) => detail.articleId !== articleIdToRemove
      )
    );
  }

  function calculateResult(detail: Detail) {
    if (selectedEffect === "SUMA") {
      return detail.stockAvailable + detail.amount;
    }

    if (selectedEffect === "RESTA") {
      return detail.stockAvailable - detail.amount;
    }

    return detail.stockAvailable;
  }

  const totalUnits = details.reduce(
    (total, detail) => total + detail.amount,
    0
  );

  async function handleSubmit() {
    if (!selectedMovementType) {
      showToast(
        "Debe seleccionar un tipo de movimiento.",
        "error"
      );
      return;
    }

    if (!depositId) {
      showToast("Debe seleccionar un depósito.", "error");
      return;
    }

    if (!employeeId) {
      showToast("Debe seleccionar un responsable.", "error");
      return;
    }

    if (details.length === 0) {
      showToast(
        "Debe agregar al menos un artículo.",
        "error"
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "http://localhost:3001/api/stock-movements",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          // Por ahora enviamos ambos.
          // type mantiene compatibilidad con el backend anterior.
          // movementTypeId servirá para la integración definitiva.
          body: JSON.stringify({
            type: selectedMovementType.movement_type,
            movementTypeId:
              selectedMovementType.movement_type_id,

            depositId: Number(depositId),
            employeeId: Number(employeeId),

            observations:
              observations.trim() || undefined,

            details: details.map((detail) => ({
              articleId: detail.articleId,
              amount: detail.amount,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "No se pudo registrar el movimiento."
        );
      }

      showToast(
        "Movimiento registrado correctamente.",
        "success"
      );

      clearForm();

      // Actualizamos stocks para que se vea el nuevo valor
      await loadData();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Error al registrar el movimiento.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const formattedDate = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4EFE4] p-10 text-[#26333B]">
        Cargando...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4EFE4] text-[#26333B]">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 border bg-white px-6 py-4 shadow-xl ${
            toast.type === "success"
              ? "border-green-700/30 text-green-800"
              : "border-red-700/30 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mx-auto max-w-[1500px] px-8 py-10 lg:px-12">
        {/* CABECERA */}
        <header className="mb-10 flex flex-col gap-6 border-b border-[#26333B]/20 pb-7 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-serif text-4xl">
              Registrar movimiento
            </h1>

            <p className="mt-3 text-base font-medium text-[#26333B]/75">
              {formattedDate}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={clearForm}
              className="border border-[#26333B]/30 px-6 py-3 text-sm transition hover:bg-[#26333B]/5"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-[#26333B] px-6 py-3 text-sm text-white transition hover:bg-[#26333B]/90 disabled:opacity-50"
            >
              {submitting
                ? "Registrando..."
                : "Registrar movimiento"}
            </button>
          </div>
        </header>

        {/* DOS COLUMNAS */}
        <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-12">
          {/* IZQUIERDA */}
          <section>
            {/* DATOS GENERALES */}
            <div className="grid gap-7 md:grid-cols-2">
              {/* TIPO */}
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[#26333B]/50">
                  TIPO DE MOVIMIENTO
                </label>

                <select
                  value={type}
                  onChange={(e) => {
                    const selected = movementTypes.find(
                      (movementType) =>
                        movementType.movement_type === e.target.value
                    );

                    if (selected) {
                      handleTypeChange(selected);
                    } else {
                      setType("");
                      setArticleId("");
                      setAmount("");
                      setDetails([]);
                    }
                  }}
                  className="w-full border border-[#26333B]/20 bg-white px-4 py-3 outline-none transition focus:border-[#CBA45C]"
                >
                  <option value="">
                    Seleccionar tipo de movimiento
                  </option>

                  {movementTypes.map((movementType) => (
                    <option
                      key={movementType.movement_type_id}
                      value={movementType.movement_type}
                    >
                      {movementType.movement_type}
                    </option>
                  ))}
                </select>

                {selectedMovementType && (
                  <p className="mt-2 text-sm text-[#26333B]/55">
                    {selectedMovementType.description}
                  </p>
                )}
              </div>

              {/* DEPÓSITO */}
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[#26333B]/50">
                  DEPÓSITO
                </label>

                <select
                  value={depositId}
                  onChange={(e) =>
                    handleDepositChange(
                      e.target.value
                    )
                  }
                  className="w-full border border-[#26333B]/20 bg-white px-4 py-3 outline-none focus:border-[#CBA45C]"
                >
                  <option value="">
                    Seleccionar depósito
                  </option>

                  {deposits.map((deposit) => (
                    <option
                      key={deposit.deposit_id}
                      value={deposit.deposit_id}
                    >
                      {deposit.deposit_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* MOTIVO */}
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[#26333B]/50">
                  MOTIVO
                </label>

                <input
                  value={observations}
                  onChange={(e) =>
                    setObservations(e.target.value)
                  }
                  placeholder="Ej. Reposición de insumos"
                  className="w-full border border-[#26333B]/20 bg-white px-4 py-3 outline-none focus:border-[#CBA45C]"
                />
              </div>

              {/* RESPONSABLE */}
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[#26333B]/50">
                  RESPONSABLE
                </label>

                <select
                  value={employeeId}
                  onChange={(e) =>
                    setEmployeeId(e.target.value)
                  }
                  className="w-full border border-[#26333B]/20 bg-white px-4 py-3 outline-none focus:border-[#CBA45C]"
                >
                  <option value="">
                    Seleccionar responsable
                  </option>

                  {employees.map((employee) => (
                    <option
                      key={employee.employees_id}
                      value={employee.employees_id}
                    >
                      {employee.employees_name}{" "}
                      {employee.employees_lastname}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ARTÍCULOS */}
            <div className="mt-12">
              <h2 className="border-b border-[#26333B]/20 pb-4 font-serif text-2xl">
                Artículos del movimiento
              </h2>

              {/* AGREGAR */}
              <div className="grid gap-4 border-b border-[#26333B]/15 py-7 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[#26333B]/50">
                    ARTÍCULO
                  </label>

                  <select
                    value={articleId}
                    disabled={!depositId}
                    onChange={(e) =>
                      setArticleId(e.target.value)
                    }
                    className="w-full border border-[#26333B]/20 bg-white px-4 py-3 outline-none disabled:bg-[#26333B]/5"
                  >
                    <option value="">
                      {depositId
                        ? "Seleccionar artículo"
                        : "Seleccione un depósito"}
                    </option>

                    {availableStocks.map((stock) => (
                      <option
                        key={stock.stock_id}
                        value={stock.article_id}
                      >
                        {stock.articles.article_code} -{" "}
                        {stock.articles.article_name}
                      </option>
                    ))}
                  </select>

                  {selectedStock && (
                    <p
                      className={`mt-2 text-sm ${
                        exceedsStock
                          ? "font-medium text-red-700"
                          : "text-[#26333B]/55"
                      }`}
                    >
                      Stock disponible:{" "}
                      {Number(
                        selectedStock.stock_amount
                      )}
                    </p>
                  )}

                  {exceedsStock && (
                    <p className="mt-1 text-sm font-medium text-red-700">
                      La cantidad supera el stock
                      disponible.
                    </p>
                  )}
                </div>

                {/* CANTIDAD */}
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[#26333B]/50">
                    CANTIDAD
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) =>
                      handleAmountChange(
                        e.target.value
                      )
                    }
                    placeholder="0"
                    className={`w-full border bg-white px-4 py-3 outline-none ${
                      exceedsStock
                        ? "border-red-500"
                        : "border-[#26333B]/20 focus:border-[#CBA45C]"
                    }`}
                  />
                </div>

                {/* BOTÓN */}
                <button
                  type="button"
                  onClick={handleAddArticle}
                  disabled={!canAddArticle}
                  className="bg-[#CBA45C] px-6 py-3 font-medium text-[#26333B] transition hover:bg-[#CBA45C]/85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Agregar artículo
                </button>
              </div>

              {/* TABLA */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#26333B]/30 text-xs tracking-[0.16em] text-[#26333B]/50">
                      <th className="px-3 py-3 text-left">
                        ARTÍCULO
                      </th>

                      <th className="px-3 py-3 text-right">
                        ACTUAL
                      </th>

                      <th className="px-3 py-3 text-right">
                        CANT.
                      </th>

                      <th className="px-3 py-3 text-right">
                        RESULT.
                      </th>

                      <th className="w-12" />
                    </tr>
                  </thead>

                  <tbody>
                    {details.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-12 text-center text-sm text-[#26333B]/45"
                        >
                          Todavía no agregaste
                          artículos.
                        </td>
                      </tr>
                    ) : (
                      details.map((detail) => (
                        <tr
                          key={detail.articleId}
                          className="border-b border-[#26333B]/10"
                        >
                          <td className="px-3 py-4">
                            <p className="font-medium">
                              {detail.articleName}
                            </p>

                            <p className="text-xs text-[#26333B]/45">
                              {detail.articleCode}
                            </p>
                          </td>

                          <td className="px-3 py-4 text-right">
                            {detail.stockAvailable}
                          </td>

                          <td className="px-3 py-4 text-right">
                            {selectedEffect ===
                            "RESTA"
                              ? "-"
                              : "+"}
                            {detail.amount}
                          </td>

                          <td className="px-3 py-4 text-right font-semibold">
                            {calculateResult(detail)}
                          </td>

                          <td className="px-3 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                removeDetail(
                                  detail.articleId
                                )
                              }
                              className="text-xl text-[#26333B]/40 hover:text-red-700"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* DERECHA */}
          <aside className="border-l border-[#26333B]/20 pl-8">
            <div className="sticky top-8">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#CBA45C]">
                IMPACTO SOBRE EL STOCK
              </p>

              <div className="mt-5 border-y border-[#26333B]/20 py-7">
                <p className="font-serif text-5xl">
                  {selectedEffect === "RESTA"
                    ? "-"
                    : "+"}
                  {totalUnits}
                </p>

                <p className="mt-2 text-sm text-[#26333B]/50">
                  unidades totales
                </p>
              </div>

              <p className="mt-6 text-sm leading-6 text-[#26333B]/65">
                {selectedEffect === "RESTA"
                  ? "El stock de cada artículo disminuirá según la cantidad registrada."
                  : selectedEffect === "SUMA"
                  ? "El stock de cada artículo aumentará según la cantidad registrada."
                  : "Seleccione un tipo de movimiento para conocer su impacto sobre el stock."}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}