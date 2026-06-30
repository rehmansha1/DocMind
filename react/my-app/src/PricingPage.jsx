import React, { useState, useEffect } from "react";
import "./PricingPage.css";
import { API_BASE_URL } from "./config";

function CheckIcon() {
  return (
    <svg className="feature-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function PricingPage({ onBack, currentUser }) {
  const [billingPeriod, setBillingPeriod] = useState("monthly"); // "monthly" or "yearly"
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Dynamically load Razorpay Checkout script if not already loaded
    if (document.getElementById("razorpay-checkout-script")) return;
    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleRazorpayCheckout = async () => {
    if (!currentUser) {
      alert("Please sign in or create an account to upgrade your workspace.");
      onBack();
      return;
    }

    setLoading(true);
    try {
      const amount = billingPeriod === "yearly" ? 1200000 : 150000;
      const response = await fetch(`${API_BASE_URL}/api/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ amount, currency: "INR" })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create subscription session.");
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_T7eCikyyB6M44t",
        amount: data.amount,
        currency: data.currency,
        name: "DocMind",
        description: `DocMind Pro - ${billingPeriod === "yearly" ? "Yearly" : "Monthly"} Plan`,
        order_id: data.order_id,
        handler: async function (paymentResponse) {
          try {
            setLoading(true);
            const verifyResponse = await fetch(`${API_BASE_URL}/api/verify-payment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${currentUser.token}`
              },
              body: JSON.stringify({
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_signature: paymentResponse.razorpay_signature
              })
            });

            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Failed to verify signature.");
            }

            alert("Upgrade Successful! Your account has been upgraded to DocMind Pro.");
            onBack();
          } catch (verifyError) {
            console.error("Verification failed:", verifyError);
            alert(`Payment verification failed: ${verifyError.message}`);
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          email: currentUser.email || ""
        },
        theme: {
          color: "#7c6af7"
        }
      };

      if (!window.Razorpay) {
        throw new Error("Razorpay script not loaded yet. Please wait a moment and try again.");
      }

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        alert(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      console.error("Subscription setup failed:", err);
      alert(`Subscription setup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: "Hobby",
      priceMonthly: 0,
      priceYearly: 0,
      description: "Explore the capabilities of AI document support.",
      features: [
        "Up to 3 PDF or Crawled website docs",
        "15 chat messages per minute limit",
        "10 document uploads/crawls per hour",
        "Shared serverless inference endpoints",
        "Standard community support",
      ],
      ctaText: "Start for Free",
      isPopular: false,
      badge: "Free Tier",
    },
    {
      name: "Pro",
      priceMonthly: 19,
      priceYearly: 15,
      description: "Perfect for power users, developers, and small business support.",
      features: [
        "Unlimited PDF or Website documents",
        "1,000 chat messages per minute (Developer tier)",
        "Zero token rate-limiting issues",
        "Custom widget creation with domain CORS lock",
        "Priority prompt processing",
        "Direct email customer support",
      ],
      ctaText: "Upgrade to Pro",
      isPopular: true,
      badge: "Most Popular",
    },
    {
      name: "Enterprise",
      priceMonthly: "Custom",
      priceYearly: "Custom",
      description: "Dedicated infrastructure, SLA-backed, and custom parameters.",
      features: [
        "Dedicated Inference Endpoints (Zero shared rate limits)",
        "Custom models trained on your domain expertise",
        "Whitelabeling & custom brand widgets",
        "Dedicated Account Manager & SLA uptime support",
        "SSO, SAML & role-based access control",
      ],
      ctaText: "Contact Sales",
      isPopular: false,
      badge: "Scale Tier",
    },
  ];

  return (
    <div className="pricing-container">
      {/* Background Orbs */}
      <div className="pricing-glow-orb purple" />
      <div className="pricing-glow-orb blue" />

      {/* Header */}
      <header className="pricing-header">
        <button className="pricing-back-btn" onClick={onBack} aria-label="Go back to dashboard">
          <BackIcon />
          <span>Dashboard</span>
        </button>
        <div className="pricing-logo">
          <div className="logo-dot" />
          DocMind
        </div>
      </header>

      {/* Main Content */}
      <main className="pricing-content">
        <div className="pricing-hero">
          <h1 className="pricing-title">Simple, Transparent Pricing</h1>
          <p className="pricing-subtitle">
            Scale your document ingestion and user queries without platform ceilings.
          </p>

          {/* Toggle */}
          <div className="billing-toggle-container">
            <span className={`toggle-label ${billingPeriod === "monthly" ? "active" : ""}`}>Monthly</span>
            <button
              className="billing-toggle-switch"
              onClick={() => setBillingPeriod(billingPeriod === "monthly" ? "yearly" : "monthly")}
              aria-label="Toggle billing cycle"
            >
              <div className={`billing-toggle-dot ${billingPeriod === "yearly" ? "yearly" : ""}`} />
            </button>
            <span className={`toggle-label ${billingPeriod === "yearly" ? "active" : ""}`}>
              Yearly <span className="discount-badge">Save 20%</span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="pricing-grid">
          {plans.map((plan) => {
            const isCustom = typeof plan.priceMonthly === "string";
            const price = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
            
            return (
              <div key={plan.name} className={`pricing-card ${plan.isPopular ? "popular" : ""}`}>
                {plan.isPopular && <div className="card-popular-border" />}
                
                <div className="card-header">
                  <span className="card-badge">{plan.badge}</span>
                  <h2 className="card-name">{plan.name}</h2>
                  <p className="card-desc">{plan.description}</p>
                </div>

                <div className="card-price-section">
                  {isCustom ? (
                    <div className="card-price-custom">{price}</div>
                  ) : (
                    <div className="card-price-amount">
                      <span className="price-currency">$</span>
                      <span className="price-number">{price}</span>
                      <span className="price-duration">/mo</span>
                    </div>
                  )}
                  {!isCustom && billingPeriod === "yearly" && (
                    <div className="price-billed-annually">Billed annually (${price * 12}/yr)</div>
                  )}
                </div>

                <ul className="card-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="feature-item">
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  className={`card-cta-btn ${plan.isPopular ? "primary" : "secondary"}`}
                  disabled={loading}
                  onClick={() => {
                    if (plan.name === "Enterprise") {
                      alert("Thank you for your interest! Please contact enterprise@docmind.ai to customize your workspace.");
                    } else if (plan.name === "Pro") {
                      handleRazorpayCheckout();
                    } else {
                      onBack();
                    }
                  }}
                >
                  {loading && plan.name === "Pro" ? "Please wait..." : plan.ctaText}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
