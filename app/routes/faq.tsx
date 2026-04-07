import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "FAQ - SAR Bundle" },
    { name: "description", content: "Frequently Asked Questions about SAR Bundle." },
  ];
};

export default function FAQ() {
  const faqs = [
    {
      q: "How does the pricing work?",
      a: "SAR Bundle uses a fair usage-based model. It's 100% free for the first 200€ of revenue generated. We charge 14.99€/mo above 200€ and a total of 39.99€/mo above 1200€. No hidden fees!"
    },
    {
      q: "Is it compatible with Online Store 2.0?",
      a: "Yes! SAR Bundle uses App Blocks. You can easily add, move, and customize the bundle builder inside your theme editor without touching any liquid code."
    },
    {
      q: "Can I customize the design?",
      a: "Absolutely. You can change colors, fonts, and layouts directly from the app admin to match your store's branding perfectly."
    },
    {
      q: "How do I track bundle sales?",
      a: "All bundle sales are tracked automatically. You can see real-time revenue and subscription status on your app dashboard."
    }
  ];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: "40px", maxWidth: "800px", margin: "0 auto", color: "#333", lineHeight: "1.6" }}>
      <h1 style={{ fontSize: "2.5rem", marginBottom: "20px" }}>Frequently Asked Questions</h1>
      <p style={{ color: "#666", marginBottom: "40px" }}>Got questions? We've got answers.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
        {faqs.map((faq, index) => (
          <div key={index} style={{ borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
            <h3 style={{ fontSize: "1.3rem", color: "#000", marginBottom: "10px" }}>{faq.q}</h3>
            <p style={{ fontSize: "1.1rem" }}>{faq.a}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "50px", backgroundColor: "#f9f9f9", padding: "30px", borderRadius: "12px", textAlign: "center" }}>
        <h3>Still need help?</h3>
        <p>Email us at <strong>support@sar-bundle.com</strong> and we'll get back to you within 24 hours.</p>
      </div>

      <footer style={{ marginTop: "50px", textAlign: "center", color: "#999" }}>
        &copy; 2026 SAR Bundle.
      </footer>
    </div>
  );
}
