export function isSensitiveLabel(text: string): boolean {
  return /\b(send|enviar|pay|pagar|buy|comprar|delete|eliminar|borrar|remove|transfer|transferir|confirm|confirmar|submit|post|publicar)\b/i.test(
    text,
  );
}
