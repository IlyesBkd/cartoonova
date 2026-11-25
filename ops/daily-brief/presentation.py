"""Short deterministic labels: no model prose, addresses or invented actions."""
import html
import json

BLOCKERS={
 'lookup_agent_unavailable':'agent de recherche indisponible',
 'lookup_unavailable':'lecture du dossier indisponible',
 'lookup_not_requested':'dossier non consulté dans le budget de recherche',
 'invalid_order_link':'commande non reliée : retrouver son identifiant',
 'context_unavailable':'commande non reliée : retrouver son identifiant',
 'order_unavailable':'commande introuvable',
 'missing_order_for_draft':'aucune commande trouvée pour l’adresse exacte du brouillon',
 'ambiguous_order_for_draft':'plusieurs commandes pour l’adresse exacte ; attribuer le brouillon',
 'history_unavailable':'historique indisponible',
 'source_unavailable':'une source d’échanges est indisponible',
 'unassigned_multi_order_exchange':'échange sans commande attribuée ; plusieurs commandes existent',
 'unassigned_exchange':'échange non relié à cette commande',
 'history_limit':'historique trop long pour la lecture bornée',
 'event_limit':'historique trop long pour la lecture bornée',
 'text_limit':'texte tronqué : original nécessaire',
 'draft_text_limit':'brouillon tronqué : original nécessaire',
 'draft_incomplete':'brouillon incomplet ou non daté',
 'draft_semantics_unproven':'portrait déjà envoyé ; utilité du brouillon à vérifier',
 'photo_request_semantics_unproven':'portrait déjà envoyé ; demande de photos à recouper',
 'invalid_or_future_date':'date de preuve invalide ou future',
 'invalid_candidate_date':'date de proposition invalide',
 'future_candidate_date':'date de proposition future',
 'forced_state':'statut forcé à contrôler',
 'unknown_state':'statut de commande inconnu',
}

def escape(s,n=120):return html.escape(' '.join(str(s or '').split())[:n])

def summary(c):
    limits=c.get('limitations',[])
    if limits:
        # Identity and actual source failures take precedence over semantic guesses.
        priority=['missing_order_for_draft','ambiguous_order_for_draft','invalid_order_link','lookup_unavailable','lookup_agent_unavailable','lookup_not_requested','context_unavailable','unassigned_multi_order_exchange']
        key=next((x for x in priority if x in limits),limits[0])
        return '⚠ À vérifier — '+BLOCKERS.get(key,'preuve structurée manquante : contrôler la commande')
    try:state=json.loads(next(e['text'] for e in c['evidence'] if e['kind']=='current_state'))
    except (ValueError,StopIteration):state={}
    events=c.get('evidence',[])
    finding=c.get('finding','unknown')
    findings={'refund_requested':'Examiner la demande de remboursement — décision humaine',
              'draft_superseded':'Brouillon dépassé par les échanges ; ne pas l’utiliser tel quel',
              'draft_update':'Adapter le brouillon aux derniers échanges',
              'awaiting_customer':'⏳ Attente client — réponse attendue au dernier échange'}
    if finding in findings:return findings[finding]
    previews=[e for e in events if e['kind'] in {'delivery.preview','delivery.poster_confirmation'} and e['status']=='sent']
    if state.get('previewStatus')=='pending' and previews and not state.get('finalImageSentAt') and not state.get('shippedAt') and not any(e['kind'] in {'retouch.request','delivery.final_image','order.final_image'} or (e['kind']=='email.incoming' and e['at']>max(x['at'] for x in previews)) for e in events):
        return '⏳ Attente client — validation de l’aperçu non enregistrée'
    if c.get('decision')=='confirmer':
        label='✅ Recoupé · '+escape(c['action'],70)
        if c['kind']=='draft':label+=' · réponds « oui '+escape(c['draftId'],8)+' »'
        return label
    if c.get('reason')=='unavailable':return '⚠ À vérifier — relecture IA indisponible'
    if c['kind']=='photos_incomplete':return '⚠ À vérifier — besoin de photos supplémentaires non établi (un fichier peut contenir plusieurs sujets)'
    if c['kind']=='draft':return '⚠ À vérifier — utilité actuelle du brouillon non établie après lecture'
    return '⚠ À vérifier — '+('contradiction entre proposition et état enregistré' if c.get('reason')=='contradiction' else 'action non établie par les échanges consultés')

def action_lines(verified):
    groups={}
    for c in verified:
        if c['decision']=='retirer':continue
        # Missing links are never merged, even when names match.
        key=c.get('orderId') or c['id']
        groups.setdefault(key,[]).append(c)
    lines=[]
    for group in list(groups.values())[:8]:
        labels=list(dict.fromkeys(summary(c) for c in group))
        lines.append('• <b>'+escape(next((c['displayLabel'] for c in group if c.get('displayLabel') and not c['displayLabel'].startswith('Dossier ')),group[0].get('displayLabel','Dossier')),60)+'</b> — '+' ; '.join(labels[:3]))
        if len(labels)>3:lines.append('<i>Autres propositions de ce dossier : à relire dans l’admin.</i>')
    if not groups:lines.append('• Aucune action actuelle confirmée ; propositions périmées écartées.')
    if len(groups)>8:lines.append('• +'+str(len(groups)-8)+' dossiers non affichés — consulter l’admin.')
    removed=sum(c['decision']=='retirer' for c in verified)
    if removed:lines.append('<i>'+str(removed)+' proposition(s) écartée(s) ; sources conservées.</i>')
    return lines
