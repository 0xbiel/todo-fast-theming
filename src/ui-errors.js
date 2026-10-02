const messages={
 scope:'Describe a visual style. Your current design is preserved.',
 auth:'Your sign-in needs refreshing. Open Account and sign in again, then retry.',
 auth_refreshed:'Your sign-in was refreshed. Try Restyle again.',
 callback:'Sign-in could not be completed. Start sign-in again in this browser.',
 setup:'Cerebras or account setup is incomplete. Your current design is preserved.',
 approval:'Owner approval or your own Cerebras key is required. Open Account to add your key.',
 quota:'Request limit or shared budget reached. Wait for the rate limit or next UTC day.',
 key:'Enter a valid Cerebras key in Account.',
 provider_auth:'Cerebras rejected the API key or model access. Check your key in Account.',
 provider_quota:'Cerebras reported an account or rate limit. Check your Cerebras account.',
 provider_config:'Cerebras rejected the model/schema configuration. The app needs a provider configuration fix.',
 output_limit:'Cerebras reached the response token limit before finishing the design. Your current design is preserved.',
 output:'Cerebras returned an unsupported or unreadable design. Your current design is preserved.',
 provider:'Cerebras could not complete this request. Your current design is preserved.',
 network:'The request timed out or could not reach the service. Your current design is preserved.'
};
// Diagnostics contain only fixed labels and bounded numbers, never provider text.
export function safeDiagnosticText(d){
 if(!d||typeof d!=='object')return '';
 const parts=[];
 const enums={stage:['provider_result','finish_reason','usage_bounds','content_type','content_size','theme_validation','secret_guard','envelope_json','response_size','response_stream','client_validation'],validation:['fields','color','theme','layout','art','shape','geometry','priority_contrast','text_contrast','json'],finishReason:['stop','length','content_filter','tool_calls','missing','other'],contentKind:['text','missing','other']};
 for(const [key,allowed] of Object.entries(enums))if(allowed.includes(d[key]))parts.push(key+'='+d[key]);
 for(const key of ['promptTokens','completionTokens','inputCap','completionCap','contentLength'])if(Number.isSafeInteger(d[key])&&d[key]>=0&&d[key]<=1000000000)parts.push(key+'='+d[key]);
 return parts.length?' (Check: '+parts.join(', ')+'.)':'';
}
export class UiError extends Error {constructor(code,diagnostic){super(messages[code]||messages.provider);this.code=code;if(['output','output_limit'].includes(code))this.message+=safeDiagnosticText(diagnostic)}}
export const styleErrorMessage=error=>error instanceof UiError?error.message:messages.provider;
export function responseError(status,code,diagnostic){
 if(Object.hasOwn(messages,code))return new UiError(code,diagnostic);
 return new UiError(status===401?'auth':status===403?'approval':status===429?'quota':status===503?'setup':status===400?'scope':'provider');
}

