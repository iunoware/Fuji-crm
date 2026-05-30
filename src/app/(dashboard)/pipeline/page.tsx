"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
// import { useRouter, useSearchParams } from "next/navigation";
// import Link from 'next/link';
import { jsPDF } from "jspdf";
import {
  Search,
  Bell,
  BarChart2,
  Phone,
  MapPin,
  // AlertCircle,
  CircleX,
  CheckCircle,
  Lock,
  Loader2,
  ArrowRight,
  FileText,
  Mail,
  MessageSquare,
  Save,
  Eye,
  X,
  CreditCard,
  // IndianRupee,
} from "lucide-react";

const PIPELINE_STAGES = [
  "Lead",
  "Converted",
  "Quote",
  "Quote Approved",
  "Invoice",
  "Payment",
  "Installation",
];
const STAGE_INDEXES: Record<string, number> = {
  Lead: 0,
  Converted: 1,
  Quote: 2,
  "Quote Approved": 3,
  Invoice: 4,
  Payment: 5,
  Installation: 6,
};
const ITEMS_PER_PAGE = 6;

const TARGET_DATE = new Date("2026-05-14T15:00:00+05:30").getTime();

function PipelineContent() {
  const { currentUser } = useAuth();
  // const router = useRouter();
  // const searchParams = useSearchParams();

  const [timeLeft, setTimeLeft] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = TARGET_DATE - now;
      return difference > 0 ? Math.floor(difference / 1000) : 0;
    };
    setTimeLeft(calculateTime());
    const timerId = setInterval(() => setTimeLeft(calculateTime()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [filterCity, setFilterCity] = useState("All Cities");

  const [showLossModal, setShowLossModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [activeLead, setActiveLead] = useState<any>(null);
  const [lossReason, setLossReason] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBlobData, setPdfBlobData] = useState<any>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, any>>({
    email: false,
    wa: false,
    saved: false,
  });

  const [convertData, setConvertData] = useState({ project_name: "", assigned_to: "" });
  const [invoiceData, setInvoiceData] = useState({
    address: "",
    inventory_id: "",
    quantity: 1,
    base_rate: 0,
    gst_percent: 9,
    installation_charge: 58428.05,
  });

  const [pages, setPages] = useState<Record<string, number>>({
    Lead: 1,
    Converted: 1,
    Quote: 1,
    "Quote Approved": 1,
    Invoice: 1,
    Payment: 1,
    Installation: 1,
  });

  const parseLeadStatus = (rawStatus: string) => {
    if (!rawStatus || typeof rawStatus !== "string") {
      return { stage: "Lead", revenue: 0, paid: 0, lastStage: "Lead", lossReason: "" };
    }
    const parts = rawStatus.split("::");
    if (parts.length < 2) {
      return {
        stage: parts[0] || "Lead",
        revenue: 0,
        paid: 0,
        lastStage: parts[0] || "Lead",
        lossReason: "",
      };
    }
    return {
      stage: parts[0],
      revenue: parseFloat(parts[1]) || 0,
      paid: parseFloat(parts[2]) || 0,
      lastStage: parts[3] || parts[0],
      lossReason: parts[4] || "",
    };
  };

  const buildLeadStatus = (
    stage: string,
    revenue = 0,
    paid = 0,
    lastStage = "",
    lossReason = "",
  ) => {
    return `${stage}::${revenue}::${paid}::${lastStage || stage}::${lossReason}`;
  };

  const normalizeStage = (stageStr: string) => {
    const s = (stageStr || "").trim().toLowerCase();
    if (s.includes("quote approved")) return "Quote Approved";
    if (s.includes("quote")) return "Quote";
    if (s.includes("invoice")) return "Invoice";
    if (s.includes("payment")) return "Payment";
    if (s.includes("install")) return "Installation";
    if (s.includes("convert")) return "Converted";
    return "Lead";
  };

  useEffect(() => {
    if (currentUser && timeLeft <= 0 && hasMounted) {
      fetchPipelineData();
    }
  }, [currentUser, timeLeft, filterCity, hasMounted]);

  const fetchPipelineData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (currentUser.role === "Super Admin" && cities.length === 0) {
        const { data: cityData } = await supabase.from("cities").select("*");
        if (cityData) setCities(cityData);
      }

      const { data: staffData } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "Staff");
      if (staffData) setStaff(staffData);

      let { data: invData, error: invError } = await supabase
        .from("inventory_stock")
        .select(`*, components_master(*)`);
      if (invError) {
        const fallback = await supabase.from("inventory_stock").select(`*`);
        invData = fallback.data;
      }
      if (invData) setInventory(invData);

      let query = supabase
        .from("leads")
        .select(`*, users(name), cities(name)`)
        .order("created_at", { ascending: false });
      if (currentUser.role === "Staff") {
        query = query.eq("assigned_to", currentUser.id);
      } else if (currentUser.role === "City Admin") {
        query = query.eq("city_id", currentUser.city_id);
      } else if (currentUser.role === "Super Admin" && filterCity !== "All Cities") {
        query = query.eq("city_id", parseInt(filterCity));
      }

      const { data } = await query;
      if (data) {
        const mappedData = data.map((lead) => {
          const parsed = parseLeadStatus(lead.status);
          const isLost = parsed.stage === "Lost";
          const activeStageStr = isLost ? parsed.lastStage : parsed.stage;
          const cleanStage = normalizeStage(activeStageStr);

          return {
            ...lead,
            pipeline_stage: cleanStage,
            is_lost: isLost,
            active_index: STAGE_INDEXES[cleanStage] ?? 0,
            revenue: parsed.revenue,
            paid: parsed.paid,
            lossReason: parsed.lossReason,
          };
        });
        setPipelineData(mappedData);
      }
    } catch (error) {
      console.error("Error fetching pipeline:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = async (leadId: string | number, newStage: string) => {
    const lead = pipelineData.find((l) => String(l.id) === String(leadId));
    if (!lead) return;

    if (newStage === "Lost") {
      setActiveLead(lead);
      setShowLossModal(true);
      return;
    }

    if (newStage === "Converted") {
      setActiveLead(lead);
      setConvertData({
        project_name: `${lead.name} Solar System`,
        assigned_to: String(lead.assigned_to || ""),
      });
      setShowConvertModal(true);
      return;
    }

    if (newStage === "Invoice") {
      setActiveLead(lead);
      setInvoiceData({ ...invoiceData, address: "", inventory_id: "" });
      setPdfPreviewUrl(null);
      setPdfBlobData(null);
      setActionStatus({ email: false, wa: false, saved: false });
      setShowInvoiceModal(true);
      return;
    }

    if (newStage === "Payment") {
      setActiveLead(lead);
      setPaymentAmount("");
      setShowPaymentModal(true);
      return;
    }

    try {
      const newStatus = buildLeadStatus(
        newStage,
        lead.revenue || 0,
        lead.paid || 0,
        newStage,
        lead.lossReason || "",
      );
      await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
      fetchPipelineData();
    } catch (error) {
      console.error("Error updating stage:", error);
    }
  };

  const handleDragStart = (
    e: React.DragEvent,
    leadId: string | number,
    currentStage: string,
  ) => {
    e.dataTransfer.setData("leadId", String(leadId));
    e.dataTransfer.setData("currentStage", currentStage);
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    e.stopPropagation();
    const leadId = e.dataTransfer.getData("leadId");
    const currentStage = e.dataTransfer.getData("currentStage");

    if (!leadId || !currentStage) return;

    const currentIndex = STAGE_INDEXES[currentStage];
    const targetIndex = STAGE_INDEXES[targetStage];

    if (targetIndex === currentIndex + 1) {
      handleStageChange(leadId, targetStage);
    } else if (targetIndex > currentIndex + 1) {
      alert(
        "Pipeline Violation: You cannot skip stages. Please move the lead sequentially.",
      );
    } else if (targetIndex < currentIndex) {
      alert("Pipeline Violation: Leads cannot be moved backward.");
    }
  };

  const handleProcessConversion = async () => {
    if (!activeLead) return;
    if (!convertData.project_name) return alert("Project Name is required.");
    setIsSubmitting(true);
    try {
      const newStatus = buildLeadStatus(
        "Converted",
        activeLead.revenue || 0,
        activeLead.paid || 0,
        "Converted",
        "",
      );
      await supabase.from("leads").update({ status: newStatus }).eq("id", activeLead.id);
      await supabase.from("tasks").insert([
        {
          project_name: convertData.project_name,
          client_name: activeLead.name,
          city_id: activeLead.city_id,
          assigned_to: convertData.assigned_to ? parseInt(convertData.assigned_to) : null,
          status: "Pending",
          document_checklist: [
            {
              id: Date.now(),
              text: `Collect Site Survey for ${activeLead.name}`,
              completed: false,
            },
            {
              id: Date.now() + 1,
              text: `Collect CAD Drawings for ${activeLead.name}`,
              completed: false,
            },
            {
              id: Date.now() + 2,
              text: `Collect Signed Contract for ${activeLead.name}`,
              completed: false,
            },
          ],
        },
      ]);
      setShowConvertModal(false);
      fetchPipelineData();
    } catch (error) {
      console.error("Error converting lead:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessLoss = async () => {
    if (!activeLead) return;
    if (!lossReason) return alert("Please provide a reason.");
    setIsSubmitting(true);
    try {
      const newStatus = buildLeadStatus(
        "Lost",
        activeLead.revenue || 0,
        activeLead.paid || 0,
        activeLead.pipeline_stage,
        lossReason,
      );
      await supabase.from("leads").update({ status: newStatus }).eq("id", activeLead.id);

      setShowLossModal(false);
      setLossReason("");
      fetchPipelineData();
    } catch (error) {
      console.error("Error marking as lost:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!activeLead) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return alert("Please enter a valid payment amount.");
    setIsSubmitting(true);
    try {
      const totalPaid = (activeLead.paid || 0) + amount;
      const newStatus = buildLeadStatus(
        "Payment",
        activeLead.revenue || 0,
        totalPaid,
        "Payment",
        "",
      );
      await supabase.from("leads").update({ status: newStatus }).eq("id", activeLead.id);

      setShowPaymentModal(false);
      setPaymentAmount("");
      fetchPipelineData();
    } catch (error) {
      console.error("Error processing payment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const numberToWords = (num: number) => {
    const a = [
      "",
      "One ",
      "Two ",
      "Three ",
      "Four ",
      "Five ",
      "Six ",
      "Seven ",
      "Eight ",
      "Nine ",
      "Ten ",
      "Eleven ",
      "Twelve ",
      "Thirteen ",
      "Fourteen ",
      "Fifteen ",
      "Sixteen ",
      "Seventeen ",
      "Eighteen ",
      "Nineteen ",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    if (num === 0) return "Zero Only";
    let temp = num;
    if ((temp = parseInt(temp.toString())).toString().length > 9) return temp.toString();
    const padded = String(temp).padStart(9, "0");
    const match = padded.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!match) return String(temp);
    let str = "";
    str +=
      parseInt(match[1]) !== 0
        ? (a[Number(match[1])] ||
            b[parseInt(match[1][0])] + " " + a[parseInt(match[1][1])]) + "Crore "
        : "";
    str +=
      parseInt(match[2]) !== 0
        ? (a[Number(match[2])] ||
            b[parseInt(match[2][0])] + " " + a[parseInt(match[2][1])]) + "Lakh "
        : "";
    str +=
      parseInt(match[3]) !== 0
        ? (a[Number(match[3])] ||
            b[parseInt(match[3][0])] + " " + a[parseInt(match[3][1])]) + "Thousand "
        : "";
    str +=
      parseInt(match[4]) !== 0
        ? (a[Number(match[4])] ||
            b[parseInt(match[4][0])] + " " + a[parseInt(match[4][1])]) + "Hundred "
        : "";
    str +=
      parseInt(match[5]) !== 0
        ? (str !== "" ? "and " : "") +
          (a[Number(match[5])] ||
            b[parseInt(match[5][0])] + " " + a[parseInt(match[5][1])])
        : "";
    return str.trim() + " Only";
  };

  const handleGeneratePreview = () => {
    if (!invoiceData.inventory_id || !invoiceData.address)
      return alert("System Details and Address are required.");
    if (!activeLead) return alert("No client selected.");
    setIsSubmitting(true);

    try {
      const item = inventory.find(
        (i) => String(i.id) === String(invoiceData.inventory_id),
      );
      if (!item) return alert("Selected inventory item not found.");

      let itemName =
        item?.item_name ||
        item?.name ||
        item?.product_name ||
        item?.component_name ||
        item?.description ||
        item?.title ||
        `Component #${item?.id}`;

      if (
        (itemName?.includes("Component") || itemName?.includes("System")) &&
        item?.components_master
      ) {
        itemName =
          item.components_master.item_name ||
          item.components_master.name ||
          item.components_master.product_name ||
          itemName;
      }

      const hsnCode = "8541";
      const qty = invoiceData.quantity;
      const baseRate = parseFloat(String(invoiceData.base_rate)) || 0;
      const installationCharge = parseFloat(String(invoiceData.installation_charge)) || 0;

      const baseAmount = baseRate * qty;
      const taxableValue = baseAmount + installationCharge;
      const rateInclTax = baseRate * (1 + (invoiceData.gst_percent * 2) / 100);
      const cgst = taxableValue * (invoiceData.gst_percent / 100);
      const sgst = taxableValue * (invoiceData.gst_percent / 100);

      const grandTotal = Math.round(taxableValue + cgst + sgst);

      const doc = new jsPDF();
      const fileName = `Tax_Invoice_${activeLead.name.replace(/\s+/g, "_")}_${Date.now()}.pdf`;

      doc.setFont("helvetica");
      doc.rect(10, 10, 190, 277);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Tax Invoice", 105, 15, { align: "center" });
      doc.line(10, 18, 200, 18);
      doc.line(105, 18, 105, 90);

      doc.setFontSize(9);
      doc.text("FUJI HI-TECH ECO LAB", 12, 23);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        "#47, Bharathiyar 7th Street,\nS.S. Colony, Madurai - 625016.\nPh:0452 4240857\nGSTIN/UIN: 33AAZPG8624M1Z0\nState Name : Tamil Nadu, Code : 33",
        12,
        27,
      );

      doc.line(10, 48, 105, 48);

      doc.setFontSize(8);
      doc.text("Buyer (Bill to)", 12, 52);
      doc.setFont("helvetica", "bold");
      doc.text(activeLead.name.toUpperCase(), 12, 57);
      doc.setFont("helvetica", "normal");
      const addressWrapped = doc.splitTextToSize(invoiceData.address, 90);
      doc.text(addressWrapped, 12, 61);

      doc.line(105, 30, 200, 30);
      doc.line(105, 42, 200, 42);
      doc.line(105, 54, 200, 54);
      doc.line(105, 66, 200, 66);
      doc.line(105, 78, 200, 78);
      doc.line(152, 18, 152, 78);

      doc.text("Invoice No.", 107, 22);
      doc.setFont("helvetica", "bold");
      doc.text(`S0028/26-27`, 107, 26);
      doc.setFont("helvetica", "normal");
      doc.text("Dated", 154, 22);
      doc.setFont("helvetica", "bold");
      doc.text(new Date().toLocaleDateString("en-GB"), 154, 26);
      doc.setFont("helvetica", "normal");

      doc.text("Delivery Note", 107, 34);
      doc.text("Mode/Terms of Payment", 154, 34);
      doc.text("Reference No. & Date.", 107, 46);
      doc.text("Other References\nSubsidy Scheme", 154, 46);
      doc.text("Buyer's Order No.", 107, 58);
      doc.text("Dated", 154, 58);
      doc.text("Dispatch Doc No.", 107, 70);
      doc.text("Delivery Note Date", 154, 70);
      doc.text("Dispatched through", 107, 82);
      doc.text("Destination", 154, 82);

      doc.line(10, 90, 200, 90);
      doc.line(10, 100, 200, 100);
      doc.text("SI\nNo.", 12, 94);
      doc.text("Description of\nGoods and Services", 40, 94);
      doc.text("HSN/SAC", 92, 94);
      doc.text("Quantity", 110, 94);
      doc.text("Rate\n(Incl. of Tax)", 125, 94);
      doc.text("Rate", 145, 94);
      doc.text("per", 160, 94);
      doc.text("Amount", 175, 94);

      const cols = [18, 90, 108, 122, 142, 158, 170];
      cols.forEach((x) => doc.line(x, 90, x, 180));

      doc.setFont("helvetica", "bold");
      doc.text("1", 14, 105);
      const wrappedItem = doc.splitTextToSize(itemName, 65);
      doc.text(wrappedItem, 20, 105);
      doc.setFont("helvetica", "normal");

      doc.text(hsnCode, 94, 105);
      doc.setFont("helvetica", "bold");
      doc.text(`${qty} Set`, 111, 105);
      doc.setFont("helvetica", "normal");
      doc.text(rateInclTax.toFixed(2), 124, 105);
      doc.text(baseRate.toFixed(2), 143, 105);
      doc.text("Set", 161, 105);
      doc.setFont("helvetica", "bold");
      doc.text((baseRate * qty).toFixed(2), 173, 105);
      doc.setFont("helvetica", "normal");

      doc.setFont("helvetica", "italic");
      doc.text("INSTALLATION & COMMISSIONING [GST]", 20, 125);
      doc.setFont("helvetica", "normal");
      doc.text("9954", 94, 125);

      doc.setFont("helvetica", "italic");
      doc.text("OUTPUT CGST", 70, 130);
      doc.text("OUTPUT SGST", 70, 135);
      doc.text("Rounded Off", 73, 140);
      doc.setFont("helvetica", "normal");

      doc.text(installationCharge.toFixed(2), 173, 125);
      doc.text(cgst.toFixed(2), 173, 130);
      doc.text(sgst.toFixed(2), 173, 135);
      doc.text("0.00", 173, 140);

      doc.line(10, 180, 200, 180);
      doc.text("Total", 80, 184);
      doc.setFont("helvetica", "bold");
      doc.text(`${qty} Set`, 111, 184);
      doc.text(`Rs ${grandTotal.toFixed(2)}`, 173, 184);
      doc.setFont("helvetica", "normal");
      doc.text("E. & O.E", 175, 188);

      doc.line(10, 190, 200, 190);
      doc.text("Amount Chargeable (in words)", 12, 194);
      doc.setFont("helvetica", "bold");
      doc.text(`Indian Rupees ${numberToWords(grandTotal)}`, 12, 199);
      doc.setFont("helvetica", "normal");

      doc.line(10, 203, 200, 203);
      doc.line(10, 220, 200, 220);
      doc.text("Taxable\nValue", 90, 207);
      doc.text("CGST\nRate | Amount", 115, 207);
      doc.text("SGST/UTGST\nRate | Amount", 145, 207);
      doc.text("Total\nTax Amount", 175, 207);

      doc.text(taxableValue.toFixed(2), 90, 215);
      doc.text(`${invoiceData.gst_percent}% | ${cgst.toFixed(2)}`, 115, 215);
      doc.text(`${invoiceData.gst_percent}% | ${sgst.toFixed(2)}`, 145, 215);
      doc.text(`${(cgst + sgst).toFixed(2)}`, 175, 215);

      doc.line(10, 225, 200, 225);
      doc.setFontSize(7);
      doc.text(
        "Declaration\nWe declare that this invoice shows the actual price of the goods\ndescribed and that all particulars are true and correct.\nCustomer's Seal and Signature",
        12,
        235,
      );
      doc.text("Company's Bank Details", 105, 235);
      doc.text(
        "A/c Holder's Name  :  FUJI HI-TECH ECO LAB\nBank Name            :  HDFC BANK LTD\nA/c No.                  :  99900019491952\nBranch & IFS Code  :  B.B.KULAM MADURAI & HDFC0005666",
        105,
        240,
      );

      doc.setFont("helvetica", "bold");
      doc.text("for FUJI HI-TECH ECO LAB", 155, 255);
      doc.setFont("helvetica", "normal");
      doc.text(
        "Prepared by                    Verified by                    Authorised Signatory",
        105,
        275,
      );

      const dataUri = doc.output("datauristring");
      const blob = doc.output("blob");

      setPdfPreviewUrl(dataUri);
      setPdfBlobData({ blob, fileName, totalAmount: grandTotal });
      setIsSubmitting(false);
    } catch (error: any) {
      console.error("Error generating preview:", error);
      alert("Failed to generate PDF Preview: " + error.message);
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!activeLead?.email) {
      alert("No email found for this client");
      return;
    }

    if (!pdfBlobData?.blob) {
      alert("No invoice PDF available. Please generate the preview first.");
      return;
    }

    setActionStatus((prev) => ({ ...prev, email: "loading" }));

    try {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(",")[1];
          const emailSubject = `Tax Invoice - ${activeLead.name} - Rs. ${pdfBlobData.totalAmount}`;
          const emailBody = `Dear ${activeLead.name},\n\nPlease find the attached Tax Invoice from Fuji Hi-Tech Eco Lab.\n\nInvoice Details:\n- Amount: Rs. ${pdfBlobData.totalAmount}\n- Date: ${new Date().toLocaleDateString()}\n- Invoice File: ${pdfBlobData.fileName}\n\nThank you for your business!\n\nBest Regards,\nFuji Hi-Tech Eco Lab Team`;

          const response = await fetch("/api/send-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_email: activeLead.email,
              client_name: activeLead.name,
              invoice_amount: pdfBlobData.totalAmount,
              file_name: pdfBlobData.fileName,
              email_subject: emailSubject,
              email_body: emailBody,
              pdfBase64: base64Data,
            }),
          });

          const contentType = response.headers.get("content-type");

          if (!response.ok) {
            let errorMsg = "Email sending failed on the server.";
            if (contentType && contentType.includes("application/json")) {
              const errResult = await response.json();
              errorMsg = errResult.error || errorMsg;
            }
            throw new Error(errorMsg);
          }

          if (contentType && contentType.includes("application/json")) {
            const result = await response.json();
            if (result.success) {
              setActionStatus((prev) => ({ ...prev, email: "done" }));
              alert(`Email sent successfully to ${activeLead.email}!`);
            } else {
              throw new Error(result.error || "Email sending failed");
            }
          } else {
            throw new Error("Received an invalid response from the server.");
          }
        } catch (err: any) {
          console.error("Email sending error:", err);
          alert("Failed to send email: " + err.message);
          setActionStatus((prev) => ({ ...prev, email: false }));
        }
      };

      reader.readAsDataURL(pdfBlobData.blob);
    } catch (err) {
      console.error("Email processing error:", err);
      alert("Error processing email. Please try again.");
      setActionStatus((prev) => ({ ...prev, email: false }));
    }
  };

  const handleSendWhatsApp = () => {
    setActionStatus((prev) => ({ ...prev, wa: "loading" }));
    if (activeLead?.phone) {
      let cleanPhone = activeLead.phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = cleanPhone.substring(1);
      if (!cleanPhone.startsWith("91")) cleanPhone = "91" + cleanPhone;

      const waMessage = encodeURIComponent(
        `Hello ${activeLead.name},\n\nYour Tax Invoice for Rs. ${pdfBlobData.totalAmount} from Fuji Hi-Tech Eco Lab is ready. Please check your email for the PDF copy.\n\nThank you!`,
      );
      window.open(`https://wa.me/${cleanPhone}?text=${waMessage}`, "_blank");
      setTimeout(() => setActionStatus((prev) => ({ ...prev, wa: "done" })), 500);
    } else {
      alert("No phone number found for this lead!");
      setActionStatus((prev) => ({ ...prev, wa: false }));
    }
  };

  const handleSaveToDocuments = async () => {
    if (!activeLead || !pdfBlobData || !currentUser) {
      alert("Missing invoice or client data.");
      return;
    }

    setActionStatus((prev) => ({ ...prev, saved: "loading" }));
    try {
      const newStatus = buildLeadStatus(
        "Invoice",
        pdfBlobData.totalAmount || activeLead.revenue || 0,
        activeLead.paid || 0,
        "Invoice",
        "",
      );
      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", activeLead.id);
      if (leadError) console.warn("Lead update warning:", leadError);

      try {
        await supabase.from("documents").insert([
          {
            file_name: pdfBlobData.fileName,
            file_url: "Generated via Pipeline Engine",
            file_size: pdfBlobData.blob.size,
            folder: "Client Agreements",
            city_id: activeLead.city_id,
            uploaded_by: currentUser.id,
          },
        ]);
      } catch (docError) {
        console.warn("Document save warning:", docError);
      }

      if (invoiceData.inventory_id && invoiceData.quantity > 0) {
        try {
          const invItem = inventory.find(
            (i) => String(i.id) === String(invoiceData.inventory_id),
          );
          if (invItem) {
            const currentStock =
              invItem.available_units ||
              invItem.available ||
              invItem.stock_quantity ||
              invItem.quantity ||
              0;
            const newStock = Math.max(0, currentStock - invoiceData.quantity);
            await supabase
              .from("inventory_stock")
              .update({ available_units: newStock })
              .eq("id", invoiceData.inventory_id);
          }
        } catch (invError) {
          console.warn("Inventory deduction warning:", invError);
        }
      }

      const url = URL.createObjectURL(pdfBlobData.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfBlobData.fileName;
      a.click();
      URL.revokeObjectURL(url);

      setActionStatus((prev) => ({ ...prev, saved: "done" }));
      setTimeout(() => {
        setShowInvoiceModal(false);
        fetchPipelineData();
      }, 1000);
    } catch (error) {
      console.error("Error in save to documents:", error);
      try {
        const url = URL.createObjectURL(pdfBlobData.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdfBlobData.fileName;
        a.click();
        URL.revokeObjectURL(url);
        setActionStatus((prev) => ({ ...prev, saved: "done" }));
        setTimeout(() => setShowInvoiceModal(false), 1000);
      } catch (fallbackError) {
        console.error("Fallback download failed:", fallbackError);
        alert("Error processing document. Please try again.");
        setActionStatus((prev) => ({ ...prev, saved: false }));
      }
    }
  };

  const handleInventorySelect = (id: string) => {
    if (!id) {
      setInvoiceData({ ...invoiceData, inventory_id: "", base_rate: 0 });
      return;
    }
    const item = inventory.find((i) => String(i.id) === String(id));
    if (!item) return;
    const price =
      item?.unit_price ||
      item?.price_rate ||
      item?.price ||
      item?.base_price ||
      item?.components_master?.base_price ||
      0;
    setInvoiceData({
      ...invoiceData,
      inventory_id: id,
      base_rate: parseFloat(price) || 0,
    });
  };

  const getInitials = (name: string) => {
    if (!name) return "L";
    const parts = name.split(" ");
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  if (!currentUser) return null;

  if (timeLeft > 0) {
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return (
      <main className="flex-1 flex flex-col items-center justify-center h-screen bg-[#f8fafc]">
        <div className="text-center bg-white p-12 rounded-3xl shadow-xl max-w-125 w-full border border-gray-150">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3 tracking-tight">
            Sales Pipeline Locked
          </h1>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            The Pipeline Kanban Board will automatically unlock and reveal itself in:
          </p>
          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-gray-100 p-4 px-5 rounded-2xl min-w-20">
              <span className="block text-3xl font-extrabold text-blue-600">
                {hours.toString().padStart(2, "0")}
              </span>
              <span className="text-[10px] text-gray-400 font-bold tracking-wider">
                HOURS
              </span>
            </div>
            <div className="bg-gray-100 p-4 px-5 rounded-2xl min-w-20">
              <span className="block text-3xl font-extrabold text-blue-600">
                {minutes.toString().padStart(2, "0")}
              </span>
              <span className="text-[10px] text-gray-400 font-bold tracking-wider">
                MINUTES
              </span>
            </div>
            <div className="bg-gray-100 p-4 px-5 rounded-2xl min-w-20">
              <span className="block text-3xl font-extrabold text-blue-600">
                {seconds.toString().padStart(2, "0")}
              </span>
              <span className="text-[10px] text-gray-400 font-bold tracking-wider">
                SECONDS
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 block h-screen bg-[#f8fafc] overflow-auto">
      <header className="flex items-center justify-between h-18 px-6 bg-[#f8fafc] shrink-0 sticky top-0 z-50 border-b border-[#e5e7eb] max-[768px]:pl-17.5 max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-100 text-gray-400 bg-white border border-[#e5e7eb] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} color="#9ca3af" />
          <input
            type="text"
            placeholder="Search pipeline..."
            className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text"
          />
        </div>
        <div className="flex items-center gap-4">
          <button className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} color="#4b5563" />
          </button>
        </div>
      </header>

      <div className="px-6 py-6 pb-4 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="m-0 text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart2 size={28} className="text-blue-600" /> Sales Pipeline{" "}
          </h1>
          <p className="m-0 mt-1 text-sm text-gray-500">
            Track stage transitions, conversions, and automate invoicing.
          </p>
        </div>
        {currentUser.role === "Super Admin" && (
          <div className="bg-white p-1.5 px-3 rounded-xl border border-[#e5e7eb]">
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="border-none outline-none font-semibold text-gray-700 cursor-pointer bg-transparent text-sm"
            >
              <option value="All Cities">All Branches</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="flex gap-4 px-6 pb-6 overflow-x-auto min-h-[calc(100vh-200px)] items-start">
          {PIPELINE_STAGES.map((stage, colIndex) => {
            const stageLeads = pipelineData.filter((l) => l.active_index >= colIndex);
            const currentPage = pages[stage] || 1;
            const totalPages = Math.max(1, Math.ceil(stageLeads.length / ITEMS_PER_PAGE));
            const safeCurrentPage = Math.min(currentPage, totalPages);
            const visibleLeads = stageLeads.slice(
              (safeCurrentPage - 1) * ITEMS_PER_PAGE,
              safeCurrentPage * ITEMS_PER_PAGE,
            );

            const getColumnColor = (idx: number) => {
              if (idx === 0) return "border-t-blue-500";
              if (idx === 1) return "border-t-purple-500";
              if (idx >= 2 && idx <= 4) return "border-t-amber-500";
              if (idx === 5) return "border-t-emerald-500";
              return "border-t-teal-500";
            };

            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => handleDrop(e, stage)}
                className={`flex-[0_0_340px] bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col max-h-full ${getColumnColor(colIndex)} border-t-4 pt-4`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="m-0 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {stage}
                  </h3>
                  <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto">
                  {visibleLeads.map((lead) => {
                    const isCurrentStage = lead.active_index === colIndex;
                    const isLostHere = lead.is_lost && isCurrentStage;
                    const isReadOnly = !isCurrentStage || lead.is_lost;
                    const nextStage = PIPELINE_STAGES[colIndex + 1];

                    return (
                      <div
                        key={`${lead.id}-${stage}`}
                        draggable={!isReadOnly}
                        onDragStart={(e) => handleDragStart(e, lead.id, stage)}
                        className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative transition-opacity ${
                          isReadOnly && !isLostHere ? "opacity-50" : "opacity-100"
                        } ${!isReadOnly ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold">
                            {getInitials(lead.name)}
                          </div>
                          <div>
                            <h4 className="m-0 text-sm font-bold text-gray-950 leading-tight">
                              {lead.name}
                            </h4>
                            <span className="text-[11px] text-gray-400">
                              Assigned: {lead.users?.name || "Unassigned"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 mb-4 text-xs text-gray-600">
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-gray-400" />{" "}
                            {lead.cities?.name || "Unknown Location"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Phone size={12} className="text-gray-400" /> {lead.phone}
                          </span>
                        </div>

                        {isLostHere && (
                          <div className="mt-3 bg-red-50 p-2.5 rounded-lg text-xs text-red-800 border border-red-200">
                            <strong>Lost Reason:</strong> {lead.loss_reason}
                          </div>
                        )}

                        {!isReadOnly && (
                          <div className="flex gap-2 border-t border-gray-100 pt-3">
                            {nextStage && (
                              <button
                                onClick={() => handleStageChange(lead.id, nextStage)}
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border-none py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1 transition-all"
                              >
                                Next: {nextStage} <ArrowRight size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => handleStageChange(lead.id, "Lost")}
                              className="bg-red-50 hover:bg-red-100 text-red-600 border-none p-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center transition-all"
                              title="Mark as Lost"
                            >
                              {/* <AlertCircle size={14} /> */}
                              <CircleX size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {stageLeads.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-xs border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                      Drop items here
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4 border-t border-slate-200 pt-3">
                    <button
                      disabled={safeCurrentPage === 1}
                      onClick={() =>
                        setPages((p) => ({ ...p, [stage]: safeCurrentPage - 1 }))
                      }
                      className="bg-white border border-gray-300 hover:bg-gray-50 p-1 px-2.5 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {"<"}
                    </button>
                    <span className="text-xs font-semibold text-gray-500">
                      Page {safeCurrentPage} of {totalPages}
                    </span>
                    <button
                      disabled={safeCurrentPage === totalPages}
                      onClick={() =>
                        setPages((p) => ({ ...p, [stage]: safeCurrentPage + 1 }))
                      }
                      className="bg-white border border-gray-300 hover:bg-gray-50 p-1 px-2.5 rounded-lg text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {">"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- SIMPLIFIED PROMOTE TO PROJECT MODAL --- */}
      {showConvertModal && activeLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-112.5 shadow-2xl">
            <h3 className="text-lg font-bold text-emerald-600 m-0 mb-2 flex items-center gap-2">
              <CheckCircle size={20} /> Convert to Project
            </h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Please set the primary details for <strong>{activeLead.name}</strong>.
            </p>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={convertData.project_name}
                  onChange={(e) =>
                    setConvertData({ ...convertData, project_name: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Assign Staff
                </label>
                <select
                  value={convertData.assigned_to}
                  onChange={(e) =>
                    setConvertData({ ...convertData, assigned_to: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-emerald-600"
                >
                  <option value="">-- Leave Unassigned --</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
                onClick={() => setShowConvertModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center gap-1.5"
                onClick={handleProcessConversion}
                disabled={isSubmitting}
              >
                <ArrowRight size={16} /> Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- INVOICE MODAL --- */}
      {showInvoiceModal && activeLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999 p-4">
          <div
            style={{ maxWidth: pdfPreviewUrl ? "900px" : "600px" }}
            className="bg-white p-6 rounded-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto transition-[max-width] duration-300"
          >
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-blue-600 m-0 flex items-center gap-2">
                <FileText size={20} />{" "}
                {pdfPreviewUrl
                  ? "Invoice Preview & Dispatch"
                  : "Generate Invoice Details"}
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {!pdfPreviewUrl ? (
              <>
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 mb-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Customer Address *
                      </label>
                      <textarea
                        value={invoiceData.address}
                        onChange={(e) =>
                          setInvoiceData({ ...invoiceData, address: e.target.value })
                        }
                        placeholder="Full Installation Address..."
                        className="w-full h-20 p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-blue-600 resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        System Configuration *
                      </label>
                      <select
                        value={invoiceData.inventory_id}
                        onChange={(e) => handleInventorySelect(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-blue-600"
                      >
                        <option value="">-- Select System --</option>
                        {inventory
                          .filter((inv) => {
                            const leadCityId = activeLead?.city_id;
                            const invCityId = inv.city_id;
                            if (!leadCityId) return true;
                            return (
                              invCityId === leadCityId ||
                              String(invCityId) === String(leadCityId)
                            );
                          })
                          .map((inv) => {
                            let displayName =
                              inv.item_name ||
                              inv.name ||
                              inv.product_name ||
                              inv.component_name ||
                              inv.description ||
                              inv.title;
                            if (
                              (!displayName ||
                                displayName.includes("Component") ||
                                displayName.includes("System")) &&
                              inv.components_master
                            ) {
                              displayName =
                                inv.components_master.item_name ||
                                inv.components_master.name ||
                                inv.components_master.product_name ||
                                displayName;
                            }
                            if (!displayName) displayName = `Component #${inv.id}`;
                            const stockCount =
                              inv.available ||
                              inv.available_units ||
                              inv.stock_quantity ||
                              inv.quantity ||
                              0;

                            return (
                              <option key={inv.id} value={inv.id}>
                                {displayName} (Stock: {stockCount})
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                        Installation Charge (₹)
                      </label>
                      <input
                        type="number"
                        value={invoiceData.installation_charge}
                        onChange={(e) =>
                          setInvoiceData({
                            ...invoiceData,
                            installation_charge: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-4">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={invoiceData.quantity}
                          onChange={(e) =>
                            setInvoiceData({
                              ...invoiceData,
                              quantity: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full p-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-blue-600 bg-white"
                        />
                      </div>
                      <div className="flex-[2_2_0%]">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          Base Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={invoiceData.base_rate}
                          onChange={(e) =>
                            setInvoiceData({
                              ...invoiceData,
                              base_rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full p-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-blue-600 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        CGST / SGST Rate (%)
                      </label>
                      <input
                        type="number"
                        value={invoiceData.gst_percent}
                        onChange={(e) =>
                          setInvoiceData({
                            ...invoiceData,
                            gst_percent: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full p-2 rounded-lg border border-gray-300 outline-none text-sm focus:border-blue-600 bg-white"
                      />
                    </div>
                    <div className="mt-auto border-t border-slate-200 pt-3">
                      <div className="flex justify-between items-center text-base font-extrabold text-slate-900">
                        <span>Est. Total:</span>
                        <span>
                          ₹{" "}
                          {(
                            (invoiceData.base_rate * invoiceData.quantity +
                              invoiceData.installation_charge) *
                            (1 + (invoiceData.gst_percent * 2) / 100)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
                    onClick={() => setShowInvoiceModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-755 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center gap-1.5"
                    onClick={handleGeneratePreview}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        <Eye size={14} /> Preview Invoice
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-[2fr_1fr] max-md:grid-cols-1 gap-6">
                <div className="bg-slate-200 rounded-xl overflow-hidden h-125 border border-slate-300">
                  <iframe
                    src={pdfPreviewUrl}
                    width="100%"
                    height="100%"
                    className="border-none"
                    title="Invoice Preview"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <p className="text-xs text-gray-500 leading-relaxed mb-2">
                    Review the document on the left. If correct, use the tools below to
                    distribute and save the invoice.
                  </p>

                  <button
                    onClick={handleSendEmail}
                    disabled={
                      actionStatus.email === "loading" || actionStatus.email === "done"
                    }
                    className={`p-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 border transition-colors cursor-pointer text-left ${
                      actionStatus.email === "done"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {actionStatus.email === "loading" ? (
                      <Loader2 className="animate-spin text-blue-600" size={20} />
                    ) : actionStatus.email === "done" ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <Mail size={20} className="text-slate-400" />
                    )}
                    <div className="flex flex-col">
                      <span>Send via Email</span>
                      <span className="text-[10px] text-gray-400 font-normal truncate max-w-50">
                        {activeLead?.email || "No email on file"}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={handleSendWhatsApp}
                    disabled={actionStatus.wa === "loading" || actionStatus.wa === "done"}
                    className={`p-3 px-4 rounded-xl text-sm font-semibold flex items-center gap-3 border transition-colors cursor-pointer text-left ${
                      actionStatus.wa === "done"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {actionStatus.wa === "loading" ? (
                      <Loader2 className="animate-spin text-blue-600" size={20} />
                    ) : actionStatus.wa === "done" ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <MessageSquare size={20} className="text-green-500" />
                    )}
                    <div className="flex flex-col">
                      <span>Send via WhatsApp</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {activeLead?.phone}
                      </span>
                    </div>
                  </button>

                  <div className="my-2 border-t border-dashed border-slate-200"></div>

                  <button
                    onClick={handleSaveToDocuments}
                    disabled={
                      actionStatus.saved === "loading" || actionStatus.saved === "done"
                    }
                    className={`w-full p-4 rounded-xl text-sm font-bold border-none cursor-pointer flex items-center justify-center gap-2 transition-all ${
                      actionStatus.saved === "done"
                        ? "bg-green-50 text-green-700"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {actionStatus.saved === "loading" ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : actionStatus.saved === "done" ? (
                      <>
                        <CheckCircle size={20} /> Saved & Pipeline Updated
                      </>
                    ) : (
                      <>
                        <Save size={20} /> Save & Update Pipeline
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setPdfPreviewUrl(null);
                      setActionStatus({ email: false, wa: false, saved: false });
                    }}
                    className="bg-transparent border-none text-gray-400 hover:text-gray-600 text-xs cursor-pointer mt-2 underline self-center"
                  >
                    Edit Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- REASONS FOR NON-CONVERSION MODAL --- */}
      {showLossModal && activeLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-100 shadow-2xl">
            <h3 className="text-lg font-bold text-red-600 m-0 mb-2 flex items-center gap-2">
              {/* <AlertCircle size={20} /> */}
              <CircleX size={20} />
              Record Non-Conversion
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Please provide the exact reason why <strong>{activeLead.name}</strong>{" "}
              dropped out of the pipeline.
            </p>
            <textarea
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="e.g. Budget constraints, opted for competitor..."
              className="w-full h-24 p-3 rounded-lg border border-gray-300 outline-none text-xs bg-white focus:border-red-500 resize-none box-border mb-5"
            />
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
                onClick={() => setShowLossModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm"
                onClick={handleProcessLoss}
                disabled={isSubmitting}
              >
                Confirm Loss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECORD PAYMENT MODAL --- */}
      {showPaymentModal && activeLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-100 shadow-2xl">
            <h3 className="text-lg font-bold text-emerald-600 m-0 mb-2 flex items-center gap-2">
              <CreditCard size={20} /> Record Payment Received
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Please enter the payment amount received from{" "}
              <strong>{activeLead.name}</strong>. This will be added to the total
              collected.
            </p>
            <div className="mb-5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                Amount Paid (₹)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-emerald-600"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm"
                onClick={handleProcessPayment}
                disabled={isSubmitting}
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Pipeline() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center w-screen bg-brand-bg">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-red"></div>
        </div>
      }
    >
      <PipelineContent />
    </Suspense>
  );
}
