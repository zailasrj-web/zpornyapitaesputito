import React, { useState } from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'compliance' | 'dmca'>('terms');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-[900px] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#0F0F0F]">
          <div>
            <h2 className="text-lg font-bold text-white">Legal Information</h2>
            <p className="text-xs text-gray-500 mt-0.5">Terms, Privacy & Compliance</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#0F0F0F] overflow-x-auto scrollbar-hide flex-shrink-0">
          <button 
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-3 text-xs font-bold transition-colors relative whitespace-nowrap flex-shrink-0 ${activeTab === 'terms' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-file-contract mr-2"></i> Terms
            {activeTab === 'terms' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('privacy')}
            className={`px-6 py-3 text-xs font-bold transition-colors relative whitespace-nowrap flex-shrink-0 ${activeTab === 'privacy' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-shield-halved mr-2"></i> Privacy
            {activeTab === 'privacy' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('compliance')}
            className={`px-6 py-3 text-xs font-bold transition-colors relative whitespace-nowrap flex-shrink-0 ${activeTab === 'compliance' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-gavel mr-2"></i> 2257
            {activeTab === 'compliance' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('dmca')}
            className={`px-6 py-3 text-xs font-bold transition-colors relative whitespace-nowrap flex-shrink-0 ${activeTab === 'dmca' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <i className="fa-solid fa-copyright mr-2"></i> DMCA
            {activeTab === 'dmca' && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent"></div>}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto custom-scrollbar flex-1">
          <div className="p-6">
          
          {/* Terms & Conditions */}
          {activeTab === 'terms' && (
            <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Terms and Conditions</h3>
                <p className="text-xs text-gray-500 mb-4">Last Updated: January 2026</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">1. Age Verification (18+)</h4>
                <p>By accessing this website, you confirm that you are at least 18 years of age (or the age of majority in your jurisdiction). This site contains adult content and is intended solely for adults. If you are under the legal age, you must leave immediately.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">2. Access Restriction</h4>
                <p>This website contains sexually explicit material. By entering, you acknowledge that:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>You are not offended by such content</li>
                  <li>You are accessing this site voluntarily</li>
                  <li>Viewing such material is legal in your jurisdiction</li>
                  <li>You will not share access with minors</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">3. User Conduct</h4>
                <p>Users are strictly prohibited from:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Downloading content without explicit permission</li>
                  <li>Using bots, scrapers, or automated tools</li>
                  <li>Attempting to hack or compromise the site</li>
                  <li>Uploading illegal or non-consensual content</li>
                  <li>Harassing other users or creators</li>
                  <li>Impersonating others</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">4. Intellectual Property</h4>
                <p>All content on this site, including videos, images, text, and logos, is protected by copyright and other intellectual property laws. Content is owned by POORN INC. or its licensors. Unauthorized use, reproduction, or distribution is strictly prohibited.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">5. Disclaimer of Liability</h4>
                <p>POORN INC. is not responsible for:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Subjective offense taken by content</li>
                  <li>Technical issues or service interruptions</li>
                  <li>Third-party content or links</li>
                  <li>User-generated content</li>
                  <li>Damages resulting from use of the site</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">6. Account Termination</h4>
                <p>We reserve the right to suspend or terminate accounts that violate these terms without prior notice or refund.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">7. Changes to Terms</h4>
                <p>We may update these terms at any time. Continued use of the site constitutes acceptance of updated terms.</p>
              </div>
            </div>
          )}

          {/* Privacy Policy */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Privacy Policy</h3>
                <p className="text-xs text-gray-500 mb-4">Last Updated: January 2026</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">1. Data Collection</h4>
                <p>We collect the following information:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li><strong>Account Data:</strong> Email address, username, display name</li>
                  <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
                  <li><strong>Usage Data:</strong> Pages visited, videos watched, search queries</li>
                  <li><strong>Payment Data:</strong> Processed securely by third-party providers (we don't store card details)</li>
                  <li><strong>Cookies:</strong> For authentication, preferences, and analytics</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">2. Use of Cookies</h4>
                <p>We use cookies and similar technologies for:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Authentication and security</li>
                  <li>Remembering your preferences</li>
                  <li>Analytics and performance monitoring</li>
                  <li>Advertising (through third-party networks)</li>
                </ul>
                <p className="mt-2">Third-party advertising networks (such as ad providers) may also use cookies to track your activity across sites. You can disable cookies in your browser settings, but this may affect site functionality.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">3. Data Usage</h4>
                <p>We use your data to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Provide and improve our services</li>
                  <li>Personalize your experience</li>
                  <li>Process payments and subscriptions</li>
                  <li>Send important notifications</li>
                  <li>Prevent fraud and abuse</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">4. Data Security</h4>
                <p>We implement industry-standard security measures including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Encryption of sensitive data (SSL/TLS)</li>
                  <li>Secure authentication systems</li>
                  <li>Regular security audits</li>
                  <li>Access controls and monitoring</li>
                </ul>
                <p className="mt-2">However, no system is 100% secure. We cannot guarantee absolute security of your data.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">5. Your Rights (GDPR/CCPA)</h4>
                <p>You have the right to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li><strong>Access:</strong> Request a copy of your data</li>
                  <li><strong>Rectification:</strong> Correct inaccurate data</li>
                  <li><strong>Erasure:</strong> Request deletion of your data</li>
                  <li><strong>Portability:</strong> Receive your data in a portable format</li>
                  <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                </ul>
                <p className="mt-2">To exercise these rights, contact us at: <a href="mailto:privacy@poorn.com" className="text-accent hover:underline">privacy@poorn.com</a></p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">6. Data Retention</h4>
                <p>We retain your data for as long as your account is active or as needed to provide services. After account deletion, we may retain certain data for legal compliance or fraud prevention.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">7. Third-Party Services</h4>
                <p>We use third-party services for:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Payment processing (Stripe, PayPal)</li>
                  <li>Analytics (Google Analytics)</li>
                  <li>Cloud storage (Firebase, Cloudinary)</li>
                  <li>Advertising networks</li>
                </ul>
                <p className="mt-2">These services have their own privacy policies and may collect data independently.</p>
              </div>
            </div>
          )}

          {/* 18 U.S.C. 2257 Compliance */}
          {activeTab === 'compliance' && (
            <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement</h3>
                <p className="text-xs text-gray-500 mb-4">Last Updated: January 2026</p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="fa-solid fa-exclamation-triangle text-yellow-400 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-xs font-bold text-yellow-400 mb-1">Important Legal Notice</p>
                    <p className="text-xs text-gray-400">All models, actors, actresses and other persons that appear in any visual depiction of actual or simulated sexually explicit conduct appearing or otherwise contained in this website were over the age of eighteen (18) years at the time of the creation of such depictions.</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Compliance Statement</h4>
                <p>POORN INC. complies with all provisions of 18 U.S.C. Section 2257 and 28 C.F.R. 75 regarding the maintenance of records for all visual depictions of actual or simulated sexually explicit conduct.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Record Custodian</h4>
                <p>All records required by 18 U.S.C. Section 2257 and 28 C.F.R. 75 are kept by the following Custodian of Records:</p>
                <div className="mt-3 bg-[#151515] border border-white/10 rounded-lg p-4">
                  <p className="font-mono text-xs">
                    Custodian of Records<br/>
                    POORN INC.<br/>
                    [Address Line 1]<br/>
                    [Address Line 2]<br/>
                    [City, State, ZIP]<br/>
                    Email: records@poorn.com
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Age Verification</h4>
                <p>We maintain strict age verification procedures:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>All content creators must provide government-issued ID</li>
                  <li>Photo verification is required for all performers</li>
                  <li>Records are maintained for all content on the platform</li>
                  <li>Regular audits ensure compliance</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">User-Generated Content</h4>
                <p>For user-uploaded content, we require:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Uploaders to certify they have proper documentation</li>
                  <li>Consent from all individuals depicted</li>
                  <li>Immediate removal of any content that violates these requirements</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Zero Tolerance Policy</h4>
                <p>We have a strict zero-tolerance policy for:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Content involving minors</li>
                  <li>Non-consensual content</li>
                  <li>Content that violates 2257 requirements</li>
                </ul>
                <p className="mt-2">Violations result in immediate account termination and reporting to authorities.</p>
              </div>
            </div>
          )}

          {/* DMCA Policy */}
          {activeTab === 'dmca' && (
            <div className="space-y-6 text-sm text-gray-300 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-white mb-3">DMCA Copyright Policy</h3>
                <p className="text-xs text-gray-500 mb-4">Last Updated: January 2026</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Copyright Infringement Notice</h4>
                <p>POORN INC. respects the intellectual property rights of others. If you believe that your copyrighted work has been uploaded to our site without authorization, please submit a DMCA takedown notice.</p>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Filing a DMCA Complaint</h4>
                <p>Your notice must include:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Your physical or electronic signature</li>
                  <li>Identification of the copyrighted work claimed to be infringed</li>
                  <li>URL(s) of the infringing material on our site</li>
                  <li>Your contact information (address, phone, email)</li>
                  <li>A statement that you have a good faith belief that the use is not authorized</li>
                  <li>A statement that the information is accurate and you are authorized to act</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Where to Send DMCA Notices</h4>
                <div className="mt-3 bg-[#151515] border border-white/10 rounded-lg p-4">
                  <p className="font-mono text-xs">
                    DMCA Agent<br/>
                    POORN INC.<br/>
                    Email: dmca@poorn.com<br/>
                    Subject: DMCA Takedown Request
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Response Time</h4>
                <p>We process valid DMCA notices within 24-48 hours. Upon receipt of a valid notice, we will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Remove or disable access to the infringing material</li>
                  <li>Notify the uploader of the removal</li>
                  <li>Terminate repeat infringers' accounts</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Counter-Notice</h4>
                <p>If you believe your content was removed in error, you may file a counter-notice containing:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Your physical or electronic signature</li>
                  <li>Identification of the removed material and its former location</li>
                  <li>A statement under penalty of perjury that the removal was a mistake</li>
                  <li>Your contact information</li>
                  <li>Consent to jurisdiction of federal court</li>
                </ul>
              </div>

              <div>
                <h4 className="text-base font-bold text-white mb-2">Repeat Infringer Policy</h4>
                <p>We maintain a policy of terminating accounts of users who repeatedly infringe copyrights. Users with multiple valid DMCA complaints will have their accounts permanently suspended.</p>
              </div>

              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="fa-solid fa-shield-halved text-red-400 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-xs font-bold text-red-400 mb-1">False Claims Warning</p>
                    <p className="text-xs text-gray-400">Filing a false DMCA notice may result in legal liability. Only submit notices if you are the copyright owner or authorized to act on their behalf.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 bg-[#0F0F0F] p-4 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            For questions about these policies, contact us at <a href="mailto:legal@poorn.com" className="text-accent hover:underline">legal@poorn.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
