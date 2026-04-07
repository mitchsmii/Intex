import './PrivacyPolicyPage.css'

function PrivacyPolicyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-inner">
        <h1>Privacy Policy</h1>
        <p className="privacy-effective">Effective date: January 1, 2026</p>

        <section>
          <h2>1. Who We Are</h2>
          <p>
            Cove ("we," "us," or "our") is a non-profit organization dedicated to providing
            safety, healing, justice, and empowerment for survivors of abuse. Our website is
            operated at this domain. For privacy inquiries, contact us at:{' '}
            <a href="mailto:privacy@cove.org">privacy@cove.org</a>.
          </p>
        </section>

        <section>
          <h2>2. What Personal Data We Collect</h2>
          <p>We collect personal data in the following contexts:</p>
          <ul>
            <li>
              <strong>Donors:</strong> Name, email address, billing address, donation amounts,
              and payment information (processed securely via our payment provider — we do not
              store full card numbers).
            </li>
            <li>
              <strong>Registered users:</strong> Name, email address, role (donor or social
              worker), and account credentials.
            </li>
            <li>
              <strong>Social workers / staff:</strong> Professional information, case notes,
              and resident interaction records entered through the platform.
            </li>
            <li>
              <strong>Website visitors:</strong> Cookies and usage data (see Section 6).
            </li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Data</h2>
          <p>We use your personal data to:</p>
          <ul>
            <li>Process and record charitable donations and issue receipts.</li>
            <li>Manage user accounts and provide access to role-appropriate features.</li>
            <li>Enable social workers to coordinate care and case management for residents.</li>
            <li>Send transactional communications (e.g., donation confirmations).</li>
            <li>Improve our website and services through aggregated analytics.</li>
            <li>Comply with legal and regulatory obligations.</li>
          </ul>
        </section>

        <section>
          <h2>4. Legal Basis for Processing (GDPR)</h2>
          <p>
            Under the General Data Protection Regulation (GDPR), we rely on the following
            legal bases for processing personal data:
          </p>
          <ul>
            <li>
              <strong>Contract performance:</strong> Processing necessary to fulfill your
              donation or account agreement.
            </li>
            <li>
              <strong>Legitimate interests:</strong> Operating and improving our platform,
              fraud prevention, and security.
            </li>
            <li>
              <strong>Legal obligation:</strong> Retaining financial records as required by
              applicable law.
            </li>
            <li>
              <strong>Consent:</strong> For cookies and optional marketing communications,
              where we ask for your explicit consent.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Data Sharing and Third Parties</h2>
          <p>
            We do not sell your personal data. We may share data with trusted service
            providers strictly to operate our platform, including:
          </p>
          <ul>
            <li>Payment processors (for donation transactions).</li>
            <li>Cloud hosting and database providers.</li>
            <li>Analytics services (using anonymized or aggregated data).</li>
          </ul>
          <p>
            All third-party processors are bound by data processing agreements and are
            required to protect your information in accordance with applicable law.
          </p>
        </section>

        <section>
          <h2>6. Cookies and Tracking</h2>
          <p>
            We use essential cookies required for the website to function (e.g., session
            management). We may also use analytics cookies to understand how visitors use
            our site. You will be asked for consent before any non-essential cookies are
            set, and you may withdraw consent at any time by clearing your browser cookies
            or using our cookie preference controls.
          </p>
        </section>

        <section>
          <h2>7. Data Retention</h2>
          <p>
            We retain personal data only for as long as necessary to fulfil the purposes
            described in this policy, or as required by law. Donation records are retained
            for a minimum of seven years for financial compliance. Account data is deleted
            or anonymized upon request, subject to legal retention requirements.
          </p>
        </section>

        <section>
          <h2>8. Your Rights</h2>
          <p>
            If you are located in the European Economic Area (EEA) or the UK, you have the
            following rights under the GDPR:
          </p>
          <ul>
            <li><strong>Access:</strong> Request a copy of the data we hold about you.</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data.</li>
            <li>
              <strong>Erasure ("right to be forgotten"):</strong> Request deletion of your
              data, subject to legal obligations.
            </li>
            <li>
              <strong>Restriction:</strong> Ask us to limit how we use your data in certain
              circumstances.
            </li>
            <li>
              <strong>Portability:</strong> Receive your data in a structured,
              machine-readable format.
            </li>
            <li>
              <strong>Objection:</strong> Object to processing based on legitimate interests.
            </li>
            <li>
              <strong>Withdraw consent:</strong> Where processing is based on consent, you
              may withdraw it at any time without affecting the lawfulness of prior processing.
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:privacy@cove.org">privacy@cove.org</a>. We will respond within
            30 days. You also have the right to lodge a complaint with your local data
            protection authority.
          </p>
        </section>

        <section>
          <h2>9. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your
            personal data against unauthorized access, alteration, disclosure, or destruction.
            This includes encrypted connections (HTTPS), access controls, and regular security
            reviews. No method of transmission over the internet is 100% secure, and we cannot
            guarantee absolute security.
          </p>
        </section>

        <section>
          <h2>10. International Transfers</h2>
          <p>
            Your data may be processed in countries outside the EEA (for example, the United
            States where our cloud infrastructure is hosted). When we transfer data
            internationally, we ensure appropriate safeguards are in place, such as Standard
            Contractual Clauses approved by the European Commission.
          </p>
        </section>

        <section>
          <h2>11. Children's Privacy</h2>
          <p>
            Our website is not directed at children under the age of 16. We do not knowingly
            collect personal data from children. If you believe a child has provided us with
            personal data, please contact us and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify registered
            users of material changes by email and will update the effective date above. We
            encourage you to review this policy periodically.
          </p>
        </section>

        <section>
          <h2>13. Contact Us</h2>
          <p>
            For any questions about this privacy policy or how we handle your personal data,
            please contact:
          </p>
          <address>
            <strong>Cove — Data Privacy</strong><br />
            <a href="mailto:privacy@cove.org">privacy@cove.org</a>
          </address>
        </section>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
